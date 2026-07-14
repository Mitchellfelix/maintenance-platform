const { z } = require("zod");

const greenTagStatusSchema = z.enum(["OPEN", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"]);

const caseInputSchema = z.object({
  title: z.string().trim().min(1),
  directions: z.string().trim().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  status: greenTagStatusSchema.optional(),
});

const createGreenTagAssignmentSchema = z.object({
  title: z.string().trim().min(1),
  summary: z.string().trim().optional().nullable(),
  assetId: z.string().min(1),
  assigneeId: z.string().min(1).optional().nullable(),
  status: greenTagStatusSchema.optional(),
  dueAt: z.coerce.date().optional().nullable(),
  /** Seed process cases (subtabs). If omitted, default process stages are used. */
  cases: z.array(caseInputSchema).optional(),
});

const updateGreenTagAssignmentSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    summary: z.string().trim().nullable().optional(),
    assetId: z.string().min(1).optional(),
    assigneeId: z.string().min(1).nullable().optional(),
    status: greenTagStatusSchema.optional(),
    dueAt: z.coerce.date().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

const createGreenTagCaseSchema = z.object({
  title: z.string().trim().min(1),
  directions: z.string().trim().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  status: greenTagStatusSchema.optional(),
});

const updateGreenTagCaseSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    directions: z.string().trim().nullable().optional(),
    sortOrder: z.coerce.number().int().min(0).optional(),
    status: greenTagStatusSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

module.exports = {
  createGreenTagAssignmentSchema,
  updateGreenTagAssignmentSchema,
  createGreenTagCaseSchema,
  updateGreenTagCaseSchema,
};
