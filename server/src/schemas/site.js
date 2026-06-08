const { z } = require("zod");

const createSiteSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
});

const updateSiteSchema = z
  .object({
    name: z.string().min(1).optional(),
    address: z.string().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

module.exports = { createSiteSchema, updateSiteSchema };
