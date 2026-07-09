const { z } = require("zod");

const createSopSchema = z.object({
  title: z.string().trim().min(1),
  department: z.string().trim().min(1),
  summary: z.string().trim().optional(),
  content: z.string().trim().optional(),
  documentUrl: z.string().trim().url().optional().or(z.literal("")),
  version: z.string().trim().min(1).optional(),
});

const updateSopSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    department: z.string().trim().min(1).optional(),
    summary: z.string().nullable().optional(),
    content: z.string().nullable().optional(),
    documentUrl: z.string().trim().url().nullable().optional().or(z.literal("")),
    version: z.string().trim().min(1).optional(),
    changeNote: z.string().trim().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

module.exports = { createSopSchema, updateSopSchema };
