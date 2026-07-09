const prisma = require("../lib/prisma");
const { canManageRole, isSiteScopedRole } = require("../lib/permissions");
const { recordAudit } = require("./auditService");

const requestInclude = {
  requester: { select: { id: true, email: true, name: true, role: true, status: true } },
  reviewer: { select: { id: true, email: true, name: true, role: true } },
};

function serializeAccessRequest(request) {
  return {
    ...request,
    requestedSiteIds: Array.isArray(request.requestedSiteIds) ? request.requestedSiteIds : [],
  };
}

async function assertNoPendingRequest(requesterId) {
  const pending = await prisma.accessRequest.findFirst({
    where: { requesterId, status: "PENDING" },
  });

  if (pending) {
    throw Object.assign(new Error("You already have a pending access request"), { status: 409 });
  }
}

async function validateSiteIds(siteIds) {
  if (!siteIds?.length) return;

  const sites = await prisma.site.findMany({
    where: { id: { in: siteIds } },
    select: { id: true },
  });

  if (sites.length !== siteIds.length) {
    throw Object.assign(new Error("One or more sites were not found"), { status: 400 });
  }
}

async function createAccessRequest(requester, data) {
  if (data.requestedRole === requester.role) {
    throw Object.assign(new Error("You already have this role"), { status: 400 });
  }

  await assertNoPendingRequest(requester.id);
  await validateSiteIds(data.requestedSiteIds);

  const request = await prisma.accessRequest.create({
    data: {
      requesterId: requester.id,
      requestedRole: data.requestedRole,
      requestedSiteIds: isSiteScopedRole(data.requestedRole) ? data.requestedSiteIds : null,
      reason: data.reason || null,
    },
    include: requestInclude,
  });

  await recordAudit({
    action: "access_request.created",
    entityType: "access_request",
    entityId: request.id,
    actorId: requester.id,
    metadata: {
      requestedRole: request.requestedRole,
      requestedSiteIds: request.requestedSiteIds,
      reason: request.reason,
    },
  });

  return serializeAccessRequest(request);
}

async function listMyAccessRequests(requesterId) {
  const requests = await prisma.accessRequest.findMany({
    where: { requesterId },
    orderBy: { createdAt: "desc" },
    include: requestInclude,
  });

  return requests.map(serializeAccessRequest);
}

async function listAccessRequests({ status } = {}) {
  const requests = await prisma.accessRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: requestInclude,
  });

  return requests.map(serializeAccessRequest);
}

async function getAccessRequestById(id) {
  const request = await prisma.accessRequest.findUnique({
    where: { id },
    include: requestInclude,
  });

  return request ? serializeAccessRequest(request) : null;
}

async function cancelAccessRequest(requester, requestId) {
  const existing = await prisma.accessRequest.findUnique({ where: { id: requestId } });
  if (!existing) {
    throw Object.assign(new Error("Access request not found"), { status: 404 });
  }
  if (existing.requesterId !== requester.id) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  if (existing.status !== "PENDING") {
    throw Object.assign(new Error("Only pending requests can be cancelled"), { status: 400 });
  }

  const request = await prisma.accessRequest.update({
    where: { id: requestId },
    data: { status: "CANCELLED" },
    include: requestInclude,
  });

  await recordAudit({
    action: "access_request.cancelled",
    entityType: "access_request",
    entityId: request.id,
    actorId: requester.id,
  });

  return serializeAccessRequest(request);
}

async function approveAccessRequest(reviewer, requestId, { reviewNote, requestedRole, requestedSiteIds } = {}) {
  const existing = await prisma.accessRequest.findUnique({
    where: { id: requestId },
    include: { requester: true },
  });

  if (!existing) {
    throw Object.assign(new Error("Access request not found"), { status: 404 });
  }
  if (existing.status !== "PENDING") {
    throw Object.assign(new Error("Only pending requests can be approved"), { status: 400 });
  }

  const finalRole = requestedRole || existing.requestedRole;
  if (!canManageRole(reviewer.role, finalRole)) {
    throw Object.assign(new Error("Cannot assign this role"), { status: 403 });
  }

  const siteIds = isSiteScopedRole(finalRole)
    ? requestedSiteIds !== undefined
      ? requestedSiteIds
      : Array.isArray(existing.requestedSiteIds)
        ? existing.requestedSiteIds
        : []
    : [];

  if (isSiteScopedRole(finalRole)) {
    await validateSiteIds(siteIds);
    if (siteIds.length === 0) {
      throw Object.assign(new Error("At least one site is required for Ops Lead or Operator access"), {
        status: 400,
      });
    }
  }

  const reviewedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: existing.requesterId },
      data: { role: finalRole, status: "ACTIVE" },
    });

    if (isSiteScopedRole(finalRole)) {
      await tx.siteAccess.deleteMany({ where: { userId: existing.requesterId } });
      if (siteIds.length > 0) {
        await tx.siteAccess.createMany({
          data: siteIds.map((siteId) => ({ userId: existing.requesterId, siteId })),
        });
      }
    } else {
      await tx.siteAccess.deleteMany({ where: { userId: existing.requesterId } });
    }

    await tx.accessRequest.update({
      where: { id: requestId },
      data: {
        status: "APPROVED",
        reviewerId: reviewer.id,
        reviewNote: reviewNote || null,
        reviewedAt,
      },
    });
  });

  await recordAudit({
    action: "user.role.updated",
    entityType: "user",
    entityId: existing.requesterId,
    actorId: reviewer.id,
    metadata: {
      from: existing.requester.role,
      to: finalRole,
      email: existing.requester.email,
      via: "access_request",
      accessRequestId: existing.id,
    },
  });

  if (isSiteScopedRole(finalRole)) {
    await recordAudit({
      action: "site_access.updated",
      entityType: "user",
      entityId: existing.requesterId,
      actorId: reviewer.id,
      metadata: { siteIds, via: "access_request", accessRequestId: existing.id },
    });
  }

  if (existing.requester.status === "PENDING") {
    await recordAudit({
      action: "user.activated",
      entityType: "user",
      entityId: existing.requesterId,
      actorId: reviewer.id,
      metadata: {
        email: existing.requester.email,
        via: "access_request",
        accessRequestId: existing.id,
      },
    });
  }

  await recordAudit({
    action: "access_request.approved",
    entityType: "access_request",
    entityId: existing.id,
    actorId: reviewer.id,
    metadata: {
      requestedRole: finalRole,
      requestedSiteIds: siteIds,
      reviewNote: reviewNote || null,
      activatedAccount: existing.requester.status !== "ACTIVE",
    },
  });

  return getAccessRequestById(requestId);
}

async function rejectAccessRequest(reviewer, requestId, reviewNote) {
  const existing = await prisma.accessRequest.findUnique({ where: { id: requestId } });
  if (!existing) {
    throw Object.assign(new Error("Access request not found"), { status: 404 });
  }
  if (existing.status !== "PENDING") {
    throw Object.assign(new Error("Only pending requests can be rejected"), { status: 400 });
  }

  const request = await prisma.accessRequest.update({
    where: { id: requestId },
    data: {
      status: "REJECTED",
      reviewerId: reviewer.id,
      reviewNote: reviewNote || null,
      reviewedAt: new Date(),
    },
    include: requestInclude,
  });

  await recordAudit({
    action: "access_request.rejected",
    entityType: "access_request",
    entityId: request.id,
    actorId: reviewer.id,
    metadata: { reviewNote: reviewNote || null },
  });

  return serializeAccessRequest(request);
}

module.exports = {
  createAccessRequest,
  listMyAccessRequests,
  listAccessRequests,
  getAccessRequestById,
  cancelAccessRequest,
  approveAccessRequest,
  rejectAccessRequest,
  validateSiteIds,
};
