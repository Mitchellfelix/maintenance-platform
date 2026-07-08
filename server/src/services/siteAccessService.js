const prisma = require("../lib/prisma");

const NO_ACCESS_PLACEHOLDER = "__no_site_access__";

async function getAccessibleSiteIds(user) {
  if (!user || user.role === "ADMIN") {
    return null;
  }

  if (user.role === "MANAGER") {
    const rows = await prisma.siteAccess.findMany({
      where: { userId: user.id },
      select: { siteId: true },
    });
    return rows.map((row) => row.siteId);
  }

  return null;
}

function buildSiteIdFilter(siteIds) {
  if (siteIds === null) {
    return {};
  }

  return {
    siteId: { in: siteIds.length > 0 ? siteIds : [NO_ACCESS_PLACEHOLDER] },
  };
}

function buildSiteRecordFilter(siteIds) {
  if (siteIds === null) {
    return {};
  }

  return {
    id: { in: siteIds.length > 0 ? siteIds : [NO_ACCESS_PLACEHOLDER] },
  };
}

async function assertSiteAccess(user, siteId) {
  if (!user || user.role === "ADMIN") {
    return;
  }

  if (user.role === "MANAGER") {
    const siteIds = await getAccessibleSiteIds(user);
    if (!siteIds.includes(siteId)) {
      throw Object.assign(new Error("Forbidden"), {
        status: 403,
        message: "You do not have access to this site",
      });
    }
  }
}

async function setUserSiteAccess(userId, siteIds, actorId) {
  await prisma.$transaction(async (tx) => {
    await tx.siteAccess.deleteMany({ where: { userId } });

    if (siteIds.length > 0) {
      await tx.siteAccess.createMany({
        data: siteIds.map((siteId) => ({ userId, siteId })),
      });
    }
  });

  const { recordAudit } = require("./auditService");
  await recordAudit({
    action: "site_access.updated",
    entityType: "user",
    entityId: userId,
    actorId,
    metadata: { siteIds },
  });
}

module.exports = {
  getAccessibleSiteIds,
  buildSiteIdFilter,
  buildSiteRecordFilter,
  assertSiteAccess,
  setUserSiteAccess,
};
