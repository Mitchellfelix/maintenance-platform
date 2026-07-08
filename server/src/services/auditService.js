const prisma = require("../lib/prisma");

async function recordAudit({ action, entityType, entityId = null, actorId = null, metadata = null }) {
  return prisma.auditLog.create({
    data: {
      action,
      entityType,
      entityId,
      actorId,
      metadata,
    },
  });
}

module.exports = { recordAudit };
