const express = require("express");
const prisma = require("../lib/prisma");
const validate = require("../middleware/validate");
const { anyAuth, timeEntriesWrite } = require("../middleware/routeGuards");
const { createTimeEntrySchema, updateTimeEntrySchema } = require("../schemas/timeEntry");
const { recordAudit } = require("../services/auditService");
const {
  getAccessibleSiteIds,
  buildSiteIdFilter,
  assertSiteAccess,
} = require("../services/siteAccessService");
const {
  canLogTimeOnWorkOrder,
  canManageTimeEntry,
  canLogForOtherUsers,
} = require("../services/timeEntryAccess");

const router = express.Router({ mergeParams: true });

const userSelect = { id: true, name: true, email: true, role: true };

async function getAccessibleWorkOrder(id, user) {
  const siteIds = await getAccessibleSiteIds(user);
  return prisma.workOrder.findFirst({
    where: { id, ...buildSiteIdFilter(siteIds) },
  });
}

function startOfUtcDay(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function assertActiveUser(userId) {
  const user = await prisma.user.findFirst({
    where: { id: userId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!user) {
    throw Object.assign(new Error("User not found or inactive"), { status: 400 });
  }
}

router.get("/", ...anyAuth, async (req, res, next) => {
  try {
    const workOrder = await getAccessibleWorkOrder(req.params.workOrderId, req.user);
    if (!workOrder) return res.status(404).json({ error: "Work order not found" });

    const entries = await prisma.workOrderTimeEntry.findMany({
      where: { workOrderId: workOrder.id },
      include: { user: { select: userSelect } },
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
    });
    res.json(entries);
  } catch (error) {
    next(error);
  }
});

router.post("/", ...timeEntriesWrite, validate(createTimeEntrySchema), async (req, res, next) => {
  try {
    const workOrder = await getAccessibleWorkOrder(req.params.workOrderId, req.user);
    if (!workOrder) return res.status(404).json({ error: "Work order not found" });
    await assertSiteAccess(req.user, workOrder.siteId);

    if (!canLogTimeOnWorkOrder(req.user, workOrder)) {
      return res.status(403).json({ error: "Forbidden", message: "You cannot log time on this work order" });
    }

    let userId = req.user.id;
    if (req.validated.userId && req.validated.userId !== req.user.id) {
      if (!canLogForOtherUsers(req.user.role)) {
        return res.status(403).json({ error: "Forbidden", message: "You can only log your own hours" });
      }
      userId = req.validated.userId;
    }
    await assertActiveUser(userId);

    const entry = await prisma.workOrderTimeEntry.create({
      data: {
        workOrderId: workOrder.id,
        userId,
        hours: req.validated.hours,
        workDate: startOfUtcDay(req.validated.workDate),
        note: req.validated.note || null,
      },
      include: { user: { select: userSelect } },
    });

    await recordAudit({
      action: "time-entry.created",
      entityType: "time-entry",
      entityId: entry.id,
      actorId: req.user.id,
      metadata: {
        workOrderId: workOrder.id,
        workOrderCode: workOrder.code,
        assetId: workOrder.assetId,
        userId,
        hours: entry.hours,
        workDate: entry.workDate,
      },
    });

    res.status(201).json(entry);
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

router.patch("/:entryId", ...timeEntriesWrite, validate(updateTimeEntrySchema), async (req, res, next) => {
  try {
    const workOrder = await getAccessibleWorkOrder(req.params.workOrderId, req.user);
    if (!workOrder) return res.status(404).json({ error: "Work order not found" });
    await assertSiteAccess(req.user, workOrder.siteId);

    const existing = await prisma.workOrderTimeEntry.findFirst({
      where: { id: req.params.entryId, workOrderId: workOrder.id },
    });
    if (!existing) return res.status(404).json({ error: "Time entry not found" });

    if (!canManageTimeEntry(req.user, existing, workOrder)) {
      return res.status(403).json({ error: "Forbidden", message: "You cannot edit this time entry" });
    }

    const data = { ...req.validated };
    if (data.workDate) data.workDate = startOfUtcDay(data.workDate);

    const entry = await prisma.workOrderTimeEntry.update({
      where: { id: existing.id },
      data,
      include: { user: { select: userSelect } },
    });

    await recordAudit({
      action: "time-entry.updated",
      entityType: "time-entry",
      entityId: entry.id,
      actorId: req.user.id,
      metadata: { workOrderId: workOrder.id, changes: req.validated },
    });

    res.json(entry);
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ error: "Forbidden", message: error.message });
    }
    next(error);
  }
});

router.delete("/:entryId", ...timeEntriesWrite, async (req, res, next) => {
  try {
    const workOrder = await getAccessibleWorkOrder(req.params.workOrderId, req.user);
    if (!workOrder) return res.status(404).json({ error: "Work order not found" });
    await assertSiteAccess(req.user, workOrder.siteId);

    const existing = await prisma.workOrderTimeEntry.findFirst({
      where: { id: req.params.entryId, workOrderId: workOrder.id },
    });
    if (!existing) return res.status(404).json({ error: "Time entry not found" });

    if (!canManageTimeEntry(req.user, existing, workOrder)) {
      return res.status(403).json({ error: "Forbidden", message: "You cannot delete this time entry" });
    }

    await prisma.workOrderTimeEntry.delete({ where: { id: existing.id } });

    await recordAudit({
      action: "time-entry.deleted",
      entityType: "time-entry",
      entityId: existing.id,
      actorId: req.user.id,
      metadata: {
        workOrderId: workOrder.id,
        userId: existing.userId,
        hours: existing.hours,
      },
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
