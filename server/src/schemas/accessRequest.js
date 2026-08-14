const { z } = require("zod");
const { ROLES } = require("../lib/permissions");

const REQUESTABLE_ROLES = ROLES.filter((role) => role !== "ADMIN" && role !== "REQUESTER");

// Sites are optional at request time; admins assign them when approving.
const createAccessRequestSchema = z.object({
  requestedRole: z.enum(REQUESTABLE_ROLES),
  requestedSiteIds: z.array(z.string().min(1)).optional(),
  reason: z.string().trim().min(1).max(1000).optional(),
});

const REGISTRATION_ROLES = ROLES.filter((role) => role !== "ADMIN");

const reviewAccessRequestSchema = z.object({
  reviewNote: z.string().trim().min(1).max(1000).optional(),
});

// Empty requestedSiteIds is allowed — the service auto-assigns all org sites.
const approveAccessRequestSchema = z.object({
  reviewNote: z.string().trim().min(1).max(1000).optional(),
  requestedRole: z.enum(REGISTRATION_ROLES).optional(),
  requestedSiteIds: z.array(z.string().min(1)).optional(),
});

module.exports = {
  createAccessRequestSchema,
  reviewAccessRequestSchema,
  approveAccessRequestSchema,
  REQUESTABLE_ROLES,
  REGISTRATION_ROLES,
};
