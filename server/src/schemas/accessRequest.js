const { z } = require("zod");
const { ROLES, isSiteScopedRole } = require("../lib/permissions");

const REQUESTABLE_ROLES = ROLES.filter((role) => role !== "ADMIN" && role !== "REQUESTER");

const createAccessRequestSchema = z
  .object({
    requestedRole: z.enum(REQUESTABLE_ROLES),
    requestedSiteIds: z.array(z.string().min(1)).optional(),
    reason: z.string().trim().min(1).max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    if (isSiteScopedRole(data.requestedRole) && (!data.requestedSiteIds || data.requestedSiteIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one site is required for Ops Lead or Operator access",
        path: ["requestedSiteIds"],
      });
    }
  });

const REGISTRATION_ROLES = ROLES.filter((role) => role !== "ADMIN");

const reviewAccessRequestSchema = z.object({
  reviewNote: z.string().trim().min(1).max(1000).optional(),
});

const approveAccessRequestSchema = z
  .object({
    reviewNote: z.string().trim().min(1).max(1000).optional(),
    requestedRole: z.enum(REGISTRATION_ROLES).optional(),
    requestedSiteIds: z.array(z.string().min(1)).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.requestedRole &&
      isSiteScopedRole(data.requestedRole) &&
      data.requestedSiteIds !== undefined &&
      data.requestedSiteIds.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one site is required for Ops Lead or Operator access",
        path: ["requestedSiteIds"],
      });
    }
  });

module.exports = {
  createAccessRequestSchema,
  reviewAccessRequestSchema,
  approveAccessRequestSchema,
  REQUESTABLE_ROLES,
  REGISTRATION_ROLES,
};
