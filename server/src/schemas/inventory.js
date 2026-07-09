const { z } = require("zod");

const createInventoryPartSchema = z.object({
  assetId: z.string().min(1),
  partNumber: z.string().trim().min(1),
  location: z.string().trim().min(1),
  description: z.string().trim().optional(),
  quantity: z.coerce.number().int().min(1).optional(),
});

const updateInventoryPartSchema = z
  .object({
    assetId: z.string().min(1).optional(),
    partNumber: z.string().trim().min(1).optional(),
    location: z.string().trim().min(1).optional(),
    description: z.string().nullable().optional(),
    quantity: z.coerce.number().int().min(1).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

module.exports = { createInventoryPartSchema, updateInventoryPartSchema };
