const { z } = require("zod");
const { ROLES } = require("../lib/permissions");

const updateUserRoleSchema = z.object({
  role: z.enum(ROLES),
});

const updateUserSitesSchema = z.object({
  siteIds: z.array(z.string().min(1)),
});

module.exports = { updateUserRoleSchema, updateUserSitesSchema };
