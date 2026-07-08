const { z } = require("zod");
const { ROLES } = require("../lib/permissions");

const updateUserRoleSchema = z.object({
  role: z.enum(ROLES),
});

module.exports = { updateUserRoleSchema };
