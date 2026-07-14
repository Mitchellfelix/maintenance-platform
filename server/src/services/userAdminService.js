const crypto = require("crypto");
const bcrypt = require("bcrypt");
const prisma = require("../lib/prisma");
const { canManageRole, isSiteScopedRole, ROLE_LABELS } = require("../lib/permissions");
const { setUserSiteAccess } = require("./siteAccessService");
const { recordAudit } = require("./auditService");
const { sendMailTo, mailConfigured, appBaseUrl, notifyAccountReady } = require("./notifyService");

const SALT_ROUNDS = 10;
const INVITE_TTL_DAYS = 7;

function authHelpers() {
  return require("./authService");
}

function generatePassword(length = 12) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

function generateInviteToken() {
  return crypto.randomBytes(32).toString("hex");
}

function serializeInvite(invite) {
  return {
    id: invite.id,
    email: invite.email,
    name: invite.name,
    role: invite.role,
    siteIds: Array.isArray(invite.siteIds) ? invite.siteIds : [],
    expiresAt: invite.expiresAt,
    acceptedAt: invite.acceptedAt,
    revokedAt: invite.revokedAt,
    createdAt: invite.createdAt,
    invitedBy: invite.invitedBy
      ? {
          id: invite.invitedBy.id,
          name: invite.invitedBy.name,
          email: invite.invitedBy.email,
        }
      : undefined,
    inviteUrl: `${appBaseUrl()}/invite/${invite.token}`,
  };
}

async function assertEmailAvailable(email) {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw Object.assign(new Error("A user with this email already exists"), { status: 409 });
  }
}

async function validateCreateSites(role, siteIds) {
  if (!isSiteScopedRole(role)) return [];
  const ids = siteIds || [];
  if (ids.length === 0) {
    throw Object.assign(new Error("At least one site is required for Ops Lead or Operator"), {
      status: 400,
    });
  }
  const sites = await prisma.site.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  if (sites.length !== ids.length) {
    throw Object.assign(new Error("One or more sites were not found"), { status: 400 });
  }
  return ids;
}

async function createUser(actor, data) {
  if (!canManageRole(actor.role, data.role)) {
    throw Object.assign(new Error("Cannot assign this role"), { status: 403 });
  }

  const email = data.email.trim().toLowerCase();
  await assertEmailAvailable(email);
  const siteIds = await validateCreateSites(data.role, data.siteIds);
  const password = data.password?.trim() || generatePassword();
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      name: data.name?.trim() || null,
      password: hashedPassword,
      role: data.role,
      status: "ACTIVE",
    },
  });

  if (isSiteScopedRole(data.role) && siteIds.length > 0) {
    await setUserSiteAccess(user.id, siteIds, actor.id);
  }

  await recordAudit({
    action: "user.created",
    entityType: "user",
    entityId: user.id,
    actorId: actor.id,
    metadata: { email: user.email, role: user.role, via: "admin_create" },
  });

  let emailResult = { skipped: true, reason: "not requested" };
  if (data.sendCredentials !== false) {
    emailResult = await notifyAccountReady({
      email,
      name: user.name,
      role: user.role,
      temporaryPassword: password,
      via: "account_created",
    });
  }

  return {
    user: authHelpers().sanitizeUser(user),
    temporaryPassword: password,
    email: emailResult,
  };
}

async function createInvite(actor, data) {
  if (!canManageRole(actor.role, data.role)) {
    throw Object.assign(new Error("Cannot invite this role"), { status: 403 });
  }

  const email = data.email.trim().toLowerCase();
  await assertEmailAvailable(email);

  const pendingInvite = await prisma.userInvite.findFirst({
    where: { email, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
  });
  if (pendingInvite) {
    throw Object.assign(new Error("A pending invite already exists for this email"), { status: 409 });
  }

  const siteIds = await validateCreateSites(data.role, data.siteIds);
  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const invite = await prisma.userInvite.create({
    data: {
      email,
      name: data.name?.trim() || null,
      role: data.role,
      siteIds: isSiteScopedRole(data.role) ? siteIds : null,
      token,
      invitedById: actor.id,
      expiresAt,
    },
    include: {
      invitedBy: { select: { id: true, name: true, email: true } },
    },
  });

  await recordAudit({
    action: "user.invite.created",
    entityType: "user_invite",
    entityId: invite.id,
    actorId: actor.id,
    metadata: { email, role: data.role, siteIds },
  });

  const serialized = serializeInvite(invite);
  let emailResult = { skipped: true, reason: "email not configured" };

  if (mailConfigured()) {
    try {
      emailResult = await sendMailTo(email, {
        subject: "You're invited to EMAT Tracking Database",
        text: [
          `Hello${invite.name ? ` ${invite.name}` : ""},`,
          "",
          `${actor.name || actor.email} invited you to EMAT Tracking Database.`,
          `Role: ${ROLE_LABELS[invite.role] || invite.role}`,
          "",
          `Accept your invite (expires in ${INVITE_TTL_DAYS} days):`,
          serialized.inviteUrl,
          "",
          "If you did not expect this email, you can ignore it.",
        ].join("\n"),
      });
    } catch (err) {
      console.error("Invite email failed:", err.message);
      emailResult = { error: err.message };
    }
  }

  return { invite: serialized, email: emailResult };
}

async function listInvites() {
  const invites = await prisma.userInvite.findMany({
    where: { acceptedAt: null, revokedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      invitedBy: { select: { id: true, name: true, email: true } },
    },
  });
  return invites.map(serializeInvite);
}

async function revokeInvite(actor, inviteId) {
  const invite = await prisma.userInvite.findUnique({ where: { id: inviteId } });
  if (!invite) {
    throw Object.assign(new Error("Invite not found"), { status: 404 });
  }
  if (invite.acceptedAt) {
    throw Object.assign(new Error("Invite already accepted"), { status: 400 });
  }
  if (invite.revokedAt) {
    throw Object.assign(new Error("Invite already revoked"), { status: 400 });
  }

  const updated = await prisma.userInvite.update({
    where: { id: inviteId },
    data: { revokedAt: new Date() },
    include: {
      invitedBy: { select: { id: true, name: true, email: true } },
    },
  });

  await recordAudit({
    action: "user.invite.revoked",
    entityType: "user_invite",
    entityId: invite.id,
    actorId: actor.id,
    metadata: { email: invite.email },
  });

  return serializeInvite(updated);
}

async function getInviteByToken(token) {
  const invite = await prisma.userInvite.findUnique({
    where: { token },
    include: {
      invitedBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!invite || invite.revokedAt) {
    throw Object.assign(new Error("Invite not found"), { status: 404 });
  }
  if (invite.acceptedAt) {
    throw Object.assign(new Error("Invite already used"), { status: 410 });
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    throw Object.assign(new Error("Invite has expired"), { status: 410 });
  }
  return serializeInvite(invite);
}

async function acceptInvite(token, { password, name }) {
  const invite = await prisma.userInvite.findUnique({ where: { token } });
  if (!invite || invite.revokedAt) {
    throw Object.assign(new Error("Invite not found"), { status: 404 });
  }
  if (invite.acceptedAt) {
    throw Object.assign(new Error("Invite already used"), { status: 410 });
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    throw Object.assign(new Error("Invite has expired"), { status: 410 });
  }

  await assertEmailAvailable(invite.email);
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const siteIds = Array.isArray(invite.siteIds) ? invite.siteIds : [];

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: invite.email,
        name: name?.trim() || invite.name || null,
        password: hashedPassword,
        role: invite.role,
        status: "ACTIVE",
      },
    });

    if (isSiteScopedRole(invite.role) && siteIds.length > 0) {
      await tx.siteAccess.createMany({
        data: siteIds.map((siteId) => ({ userId: created.id, siteId })),
      });
    }

    await tx.userInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });

    return created;
  });

  await recordAudit({
    action: "user.invite.accepted",
    entityType: "user",
    entityId: user.id,
    actorId: user.id,
    metadata: { email: user.email, role: user.role, inviteId: invite.id },
  });

  void notifyAccountReady({
    email: user.email,
    name: user.name,
    role: user.role,
    via: "invite_accepted",
  });

  return {
    user: authHelpers().sanitizeUser(user),
    token: authHelpers().signToken(user),
  };
}

module.exports = {
  createUser,
  createInvite,
  listInvites,
  revokeInvite,
  getInviteByToken,
  acceptInvite,
  generatePassword,
};
