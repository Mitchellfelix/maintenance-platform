const prisma = require("../lib/prisma");
const { isSiteScopedRole } = require("../lib/permissions");

const NO_ACCESS_PLACEHOLDER = "__no_site_access__";

/**
 * @returns {Promise<string[]|null>}
 *   null  — unrestricted (ADMIN only)
 *   []    — authenticated but no sites (or unauthenticated) → empty results
 *   ids   — site-scoped list
 */
async function getAccessibleSiteIds(user) {
  if (!user) {
    return [];
  }

  if (user.role === "ADMIN") {
    return null;
  }

  if (isSiteScopedRole(user.role)) {
    const rows = await prisma.siteAccess.findMany({
      where: { userId: user.id },
      select: { siteId: true },
    });
    return rows.map((row) => row.siteId);
  }

  // REQUESTER and other non-scoped authenticated roles: full site list (product reads).
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
  if (!user) {
    throw Object.assign(new Error("Unauthorized"), {
      status: 401,
      message: "Authentication required",
    });
  }

  if (user.role === "ADMIN") {
    return;
  }

  if (isSiteScopedRole(user.role)) {
    const siteIds = await getAccessibleSiteIds(user);
    if (!siteIds || !siteIds.includes(siteId)) {
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
