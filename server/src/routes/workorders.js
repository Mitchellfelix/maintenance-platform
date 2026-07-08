const express = require("express");
const prisma = require("../lib/prisma");
const validate = require("../middleware/validate");
const { workOrdersCreate, workOrdersUpdate, workOrdersDelete } = require("../middleware/routeGuards");
const { createWorkOrderSchema, updateWorkOrderSchema } = require("../schemas/workOrder");
const { createWorkOrderWithCode } = require("../services/workOrderCode");
const { applyStatusTimestamps } = require("../services/workOrderStatus");
const { canEditWorkOrder, filterWorkOrderUpdate } = require("../services/workOrderAccess");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const orders = await prisma.workOrder.findMany({
      include: { asset: true, assignee: true, requester: true, site: true, notes: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const order = await prisma.workOrder.findUnique({
      where: { id: req.params.id },
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
    const workOrder = await createWorkOrderWithCode({
      ...req.validated,
      requesterId: req.user.id,
    });
    res.status(201).json(workOrder);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", ...workOrdersUpdate, validate(updateWorkOrderSchema), async (req, res, next) => {
  try {
    const existing = await prisma.workOrder.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Work order not found" });

    if (!canEditWorkOrder(req.user, existing)) {
      return res.status(403).json({ error: "Forbidden", message: "You cannot edit this work order" });
    }

    const filtered = filterWorkOrderUpdate(req.user, req.validated);
    if (Object.keys(filtered).length === 0) {
      return res.status(400).json({ error: "No allowed fields to update for your role" });
    }

    const data = applyStatusTimestamps(existing, filtered);
    const workOrder = await prisma.workOrder.update({
      where: { id: req.params.id },
      data,
    });
    res.json(workOrder);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", ...workOrdersDelete, async (req, res, next) => {
  try {
    await prisma.workOrder.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
