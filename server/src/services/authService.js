const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const { recordAudit } = require("./auditService");
const { isSiteScopedRole } = require("../lib/permissions");
const { validateSiteIds } = require("./accessRequestService");
const { notifyAccessRequestCreated } = require("./notifyService");

const SALT_ROUNDS = 10;

function sanitizeUser(user) {
  const { password, ...rest } = user;
  return rest;
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );
}

async function register({
  email,
  password,
  name,
  requestedRole = "REQUESTER",
  requestedSiteIds,
  reason,
}) {
  const normalizedEmail = email.trim().toLowerCase();
  const existingCount = await prisma.user.count();
  const isBootstrapUser = existingCount === 0;
  const status = isBootstrapUser ? "ACTIVE" : "PENDING";

  if (isSiteScopedRole(requestedRole)) {
    await validateSiteIds(requestedSiteIds);
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name,
        role: "REQUESTER",
        status,
      },
    });

    if (!isBootstrapUser) {
      await tx.accessRequest.create({
        data: {
          requesterId: created.id,
          requestedRole,
          requestedSiteIds: isSiteScopedRole(requestedRole) ? requestedSiteIds : null,
          reason: reason || null,
        },
      });
    }

    return created;
  });

  if (!isBootstrapUser) {
    await recordAudit({
      action: "user.registered",
      entityType: "user",
      entityId: user.id,
      actorId: user.id,
      metadata: { email: user.email, requestedRole, status: "PENDING" },
    });

    const pendingRequest = await prisma.accessRequest.findFirst({
      where: { requesterId: user.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: {
        requester: { select: { id: true, email: true, name: true, role: true, status: true } },
        reviewer: { select: { id: true, email: true, name: true, role: true } },
      },
    });
    if (pendingRequest) {
      void notifyAccessRequestCreated({
        ...pendingRequest,
        requestedSiteIds: Array.isArray(pendingRequest.requestedSiteIds)
          ? pendingRequest.requestedSiteIds
          : [],
      });
    }
  }

  if (status === "PENDING") {
    return {
      user: sanitizeUser(user),
      pendingApproval: true,
      message: "Your account is pending admin approval. You can sign in after an admin approves your request.",
    };
  }

  return { user: sanitizeUser(user), token: signToken(user) };
}

async function login({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    throw Object.assign(new Error("Invalid credentials"), { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    throw Object.assign(new Error("Invalid credentials"), { status: 401 });
  }

  if (user.status !== "ACTIVE") {
    throw Object.assign(
      new Error("Your account is pending admin approval. Please try again after an admin approves your access request."),
      { status: 403 },
    );
  }

  return { user: sanitizeUser(user), token: signToken(user) };
}

async function getUserById(id) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw Object.assign(new Error("User not found"), { status: 404 });
  }
  if (user.status !== "ACTIVE") {
    throw Object.assign(new Error("Account pending approval"), { status: 403 });
  }
  return sanitizeUser(user);
}

module.exports = { register, login, getUserById, sanitizeUser, signToken };
