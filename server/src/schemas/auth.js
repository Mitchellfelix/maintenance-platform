const { z } = require("zod");
const { ROLES } = require("../lib/permissions");

const REGISTRATION_ROLES = ROLES.filter((role) => role !== "ADMIN");

// Sites are optional at request time; admins assign them when approving site-scoped roles.
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
  requestedRole: z.enum(REGISTRATION_ROLES).optional(),
  requestedSiteIds: z.array(z.string().min(1)).optional(),
  reason: z.string().trim().min(1).max(1000).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const requestPasswordResetSchema = z.object({
  email: z.string().email(),
});

const completePasswordResetSchema = z.object({
  password: z.string().min(8).max(128),
});

module.exports = {
  registerSchema,
  loginSchema,
  requestPasswordResetSchema,
  completePasswordResetSchema,
  REGISTRATION_ROLES,
};
