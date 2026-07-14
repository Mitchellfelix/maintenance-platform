const { z } = require("zod");
const { ROLES, isSiteScopedRole } = require("../lib/permissions");

const createUserSchema = z
  .object({
    email: z.string().email(),
    name: z.string().trim().min(1).max(120).optional(),
    role: z.enum(ROLES),
    password: z.string().min(8).max(128).optional(),
    siteIds: z.array(z.string().min(1)).optional(),
    sendCredentials: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (isSiteScopedRole(value.role) && !(value.siteIds?.length > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one site is required for Ops Lead or Operator",
        path: ["siteIds"],
      });
    }
  });

const createInviteSchema = z
  .object({
    email: z.string().email(),
    name: z.string().trim().min(1).max(120).optional(),
    role: z.enum(ROLES),
    siteIds: z.array(z.string().min(1)).optional(),
  })
  .superRefine((value, ctx) => {
    if (isSiteScopedRole(value.role) && !(value.siteIds?.length > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one site is required for Ops Lead or Operator",
        path: ["siteIds"],
      });
    }
  });

const acceptInviteSchema = z.object({
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(120).optional(),
});

const updateUserRoleSchema = z.object({
  role: z.enum(ROLES),
});

const updateUserSitesSchema = z.object({
  siteIds: z.array(z.string().min(1)),
});

module.exports = {
  createUserSchema,
  createInviteSchema,
  acceptInviteSchema,
  updateUserRoleSchema,
  updateUserSitesSchema,
};
