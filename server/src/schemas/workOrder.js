const { z } = require("zod");

const workOrderStatusSchema = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
]);

const workOrderPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

const createWorkOrderSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: workOrderStatusSchema.optional(),
  priority: workOrderPrioritySchema.optional(),
  siteId: z.string().min(1),
  assetId: z.string().min(1).optional(),
  assigneeId: z.string().min(1).optional(),
  dueAt: z.coerce.date().optional(),
});

const updateWorkOrderSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    status: workOrderStatusSchema.optional(),
    priority: workOrderPrioritySchema.optional(),
    siteId: z.string().min(1).optional(),
    assetId: z.string().min(1).nullable().optional(),
    assigneeId: z.string().min(1).nullable().optional(),
    dueAt: z.coerce.date().nullable().optional(),
    startedAt: z.coerce.date().nullable().optional(),
    completedAt: z.coerce.date().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

module.exports = { createWorkOrderSchema, updateWorkOrderSchema };
