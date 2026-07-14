const express = require("express");
const prisma = require("../lib/prisma");
const validate = require("../middleware/validate");
const { workOrdersCreate, workOrdersUpdate, workOrdersDelete, workOrdersRead, workOrdersAssign } = require("../middleware/routeGuards");
const { createWorkOrderSchema, updateWorkOrderSchema } = require("../schemas/workOrder");
const { createWorkOrderWithCode } = require("../services/workOrderCode");
const { applyStatusTimestamps } = require("../services/workOrderStatus");
const { canEditWorkOrder, filterWorkOrderUpdate } = require("../services/workOrderAccess");
const { recordAudit } = require("../services/auditService");
const { getAccessibleSiteIds, buildSiteIdFilter, assertSiteAccess } = require("../services/siteAccessService");
const { hasPermission } = require("../lib/permissions");
const { USER_PUBLIC_SELECT } = require("../lib/userSelect");

const router = express.Router();

const workOrderUserInclude = { select: USER_PUBLIC_SELECT };

async function assertActiveAssignee(assigneeId) {
  if (!assigneeId) return;
  const assignee = await prisma.user.findFirst({
    where: { id: assigneeId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!assignee) {
    throw Object.assign(new Error("Assignee not found or inactive"), { status: 400 });
  }
}
router.get("/", ...workOrdersRead, async (req, res, next) => {
  try {
    const siteIds = await getAccessibleSiteIds(req.user);
    const orders = await prisma.workOrder.findMany({
      where: buildSiteIdFilter(siteIds),
      include: {
        asset: true,
        assignee: workOrderUserInclude,
        requester: workOrderUserInclude,
        site: true,
        notes: true,
        timeEntries: { include: { user: workOrderUserInclude } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", ...workOrdersRead, async (req, res, next) => {
  try {
    const siteIds = await getAccessibleSiteIds(req.user);
    const order = await prisma.workOrder.findFirst({
      where: { id: req.params.id, ...buildSiteIdFilter(siteIds) },
      include: {
        asset: true,
        assignee: workOrderUserInclude,
        requester: workOrderUserInclude,
        site: true,
        notes: true,
        timeEntries: {
          include: { user: workOrderUserInclude },
          orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
        },
      },
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

    const payload = { ...req.validated, requesterId: req.user.id };
    if (!hasPermission(req.user.role, "workorders:assign")) {
      delete payload.assigneeId;
    } else {
      await assertActiveAssignee(payload.assigneeId);
    }

    const workOrder = await createWorkOrderWithCode(payload);

    await recordAudit({
      action: "workorder.created",
      entityType: "workorder",
      entityId: workOrder.id,
      actorId: req.user.id,
      metadata: { code: workOrder.code, siteId: workOrder.siteId, assigneeId: workOrder.assigneeId || null },
    });

    res.status(201).json(workOrder);
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ error: "Forbidden", message: error.message });
    }
    if (error.status === 400) {
      return res.status(400).json({ error: error.message });
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
    if (Object.prototype.hasOwnProperty.call(filtered, "assigneeId") && filtered.assigneeId) {
      await assertActiveAssignee(filtered.assigneeId);
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
    if (error.status === 400) {
      return res.status(400).json({ error: error.message });
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
