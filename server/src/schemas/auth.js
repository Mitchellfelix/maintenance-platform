const { z } = require("zod");
const { ROLES, isSiteScopedRole } = require("../lib/permissions");

const REGISTRATION_ROLES = ROLES.filter((role) => role !== "ADMIN");

const registerSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(1).optional(),
    requestedRole: z.enum(REGISTRATION_ROLES).optional(),
    requestedSiteIds: z.array(z.string().min(1)).optional(),
    reason: z.string().trim().min(1).max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    const requestedRole = data.requestedRole || "REQUESTER";
    if (
      isSiteScopedRole(requestedRole) &&
      (!data.requestedSiteIds || data.requestedSiteIds.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one site is required for Ops Lead or Operator access",
        path: ["requestedSiteIds"],
      });
    }
  });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

module.exports = { registerSchema, loginSchema, REGISTRATION_ROLES };
