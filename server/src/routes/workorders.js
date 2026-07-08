const express = require("express");
const prisma = require("../lib/prisma");
const optionalAuth = require("../middleware/optionalAuth");
const validate = require("../middleware/validate");
const { workOrdersCreate, workOrdersUpdate, workOrdersDelete } = require("../middleware/routeGuards");
const { createWorkOrderSchema, updateWorkOrderSchema } = require("../schemas/workOrder");
const { createWorkOrderWithCode } = require("../services/workOrderCode");
const { applyStatusTimestamps } = require("../services/workOrderStatus");
const { canEditWorkOrder, filterWorkOrderUpdate } = require("../services/workOrderAccess");
const { recordAudit } = require("../services/auditService");
const { getAccessibleSiteIds, buildSiteIdFilter, assertSiteAccess } = require("../services/siteAccessService");

const router = express.Router();

router.get("/", optionalAuth, async (req, res, next) => {
  try {
    const siteIds = await getAccessibleSiteIds(req.user);
    const orders = await prisma.workOrder.findMany({
      where: buildSiteIdFilter(siteIds),
      include: { asset: true, assignee: true, requester: true, site: true, notes: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", optionalAuth, async (req, res, next) => {
  try {
    const siteIds = await getAccessibleSiteIds(req.user);
    const order = await prisma.workOrder.findFirst({
      where: { id: req.params.id, ...buildSiteIdFilter(siteIds) },
      include: { asset: true, assignee: true, requester: true, site: true, notes: true },
    });
    if (!order) return res.status(404).json({ error: "Work order not found" });
    res.json(order);
  } catch (error) {
    next(error);
  }
});

router.post("/", ...workOrdersCreate, validate(createWorkOrderSchema), async (req, res, next) => {
  try {
    await assertSiteAccess(req.user, req.validated.siteId);

    const workOrder = await createWorkOrderWithCode({
      ...req.validated,
      requesterId: req.user.id,
    });

    await recordAudit({
      action: "workorder.created",
      entityType: "workorder",
      entityId: workOrder.id,
      actorId: req.user.id,
      metadata: { code: workOrder.code, siteId: workOrder.siteId },
    });

    res.status(201).json(workOrder);
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ error: "Forbidden", message: error.message });
    }
    next(error);
  }
});

router.patch("/:id", ...workOrdersUpdate, validate(updateWorkOrderSchema), async (req, res, next) => {
  try {
    const existing = await prisma.workOrder.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Work order not found" });

    await assertSiteAccess(req.user, existing.siteId);

    if (!canEditWorkOrder(req.user, existing)) {
      return res.status(403).json({ error: "Forbidden", message: "You cannot edit this work order" });
    }

    const filtered = filterWorkOrderUpdate(req.user, req.validated);
    if (Object.keys(filtered).length === 0) {
      return res.status(400).json({ error: "No allowed fields to update for your role" });
    }

    if (filtered.siteId) {
      await assertSiteAccess(req.user, filtered.siteId);
    }

    const data = applyStatusTimestamps(existing, filtered);
    const workOrder = await prisma.workOrder.update({
      where: { id: req.params.id },
      data,
    });

    await recordAudit({
      action: "workorder.updated",
      entityType: "workorder",
      entityId: workOrder.id,
      actorId: req.user.id,
      metadata: filtered,
    });

    res.json(workOrder);
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ error: "Forbidden", message: error.message });
    }
    next(error);
  }
});

router.delete("/:id", ...workOrdersDelete, async (req, res, next) => {
  try {
    const existing = await prisma.workOrder.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Record not found" });

    await assertSiteAccess(req.user, existing.siteId);

    await prisma.workOrder.delete({ where: { id: req.params.id } });

    await recordAudit({
      action: "workorder.deleted",
      entityType: "workorder",
      entityId: req.params.id,
      actorId: req.user.id,
      metadata: { code: existing.code },
    });

    res.status(204).send();
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ error: "Forbidden", message: error.message });
    }
    next(error);
  }
});

module.exports = router;
