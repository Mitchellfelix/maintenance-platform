const { z } = require("zod");

const hoursSchema = z.coerce
  .number()
  .positive("Hours must be greater than 0")
  .max(24, "Hours cannot exceed 24 per entry");

const createTimeEntrySchema = z.object({
  hours: hoursSchema,
  workDate: z.coerce.date(),
  note: z.string().max(2000).optional().nullable(),
  /** Ops Lead / Admin may log hours for another active user. */
  userId: z.string().min(1).optional(),
});

const updateTimeEntrySchema = z
  .object({
    hours: hoursSchema.optional(),
    workDate: z.coerce.date().optional(),
    note: z.string().max(2000).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

module.exports = { createTimeEntrySchema, updateTimeEntrySchema };
