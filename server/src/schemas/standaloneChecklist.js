const { z } = require("zod");

const createStandaloneChecklistSchema = z.object({
  title: z.string().trim().min(1),
  notes: z.string().trim().optional().nullable(),
  items: z
    .array(
      z.object({
        label: z.string().trim().min(1),
        sortOrder: z.coerce.number().int().min(0).optional(),
      }),
    )
    .optional(),
});

const updateStandaloneChecklistSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    notes: z.string().trim().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

const createStandaloneItemSchema = z.object({
  label: z.string().trim().min(1),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

const updateStandaloneItemSchema = z
  .object({
    label: z.string().trim().min(1).optional(),
    sortOrder: z.coerce.number().int().min(0).optional(),
    completed: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

module.exports = {
  createStandaloneChecklistSchema,
  updateStandaloneChecklistSchema,
  createStandaloneItemSchema,
  updateStandaloneItemSchema,
};
