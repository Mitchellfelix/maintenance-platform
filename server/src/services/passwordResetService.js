const bcrypt = require("bcrypt");
const prisma = require("../lib/prisma");
const { recordAudit } = require("./auditService");
const { sendMailTo, mailConfigured, appBaseUrl } = require("./notifyService");
const { hashToken, generateToken } = require("../lib/tokens");

const SALT_ROUNDS = 10;
const RESET_TTL_MS = 30 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

const GENERIC_MESSAGE =
  "If an account exists for that email, a password reset link has been sent.";

/** @type {Map<string, number[]>} */
const requestTimestampsByKey = new Map();

function authHelpers() {
  return require("./authService");
}

function rateLimitKey(email, ip) {
  return `${email}|${ip || "unknown"}`;
}

function isRateLimited(key) {
  const now = Date.now();
  const recent = (requestTimestampsByKey.get(key) || []).filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS,
  );
  requestTimestampsByKey.set(key, recent);
  if (recent.length >= RATE_LIMIT_MAX) return true;
  recent.push(now);
  requestTimestampsByKey.set(key, recent);
  return false;
}

function serializeResetPreview(reset) {
  return {
    email: reset.user.email,
    expiresAt: reset.expiresAt,
  };
}

async function requestPasswordReset({ email, ip }) {
  const normalizedEmail = email.trim().toLowerCase();
  const key = rateLimitKey(normalizedEmail, ip);

  if (isRateLimited(key)) {
    // Same generic response — do not reveal rate limiting to attackers via message text alone.
    return { message: GENERIC_MESSAGE };
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || user.status !== "ACTIVE") {
    return { message: GENERIC_MESSAGE };
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await prisma.passwordReset.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      token: hashToken(token),
      expiresAt,
    },
  });

  const resetUrl = `${appBaseUrl()}/reset-password/${token}`;
  let emailResult = { skipped: true, reason: "email not configured" };

  if (mailConfigured()) {
    try {
      emailResult = await sendMailTo(user.email, {
        subject: "Reset your EMAT password",
        text: [
          user.name ? `Hello ${user.name},` : "Hello,",
          "",
          "We received a request to reset your EMAT Tracking Database password.",
          "",
          `Reset your password (link expires in 30 minutes):`,
          resetUrl,
          "",
          "If you did not request this, you can ignore this email.",
        ].join("\n"),
      });
    } catch (err) {
      console.error("Password reset email failed:", err.message);
      emailResult = { error: err.message };
    }
  } else {
    console.warn(`Password reset created for ${user.email} but email is not configured.`);
  }

  await recordAudit({
    action: "user.password_reset.requested",
    entityType: "user",
    entityId: user.id,
    actorId: user.id,
    metadata: {
      email: user.email,
      emailSent: Boolean(emailResult.sent),
    },
  });

  // Expose raw token only under Jest so tests can exercise the hashed-token flow.
  if (process.env.NODE_ENV === "test") {
    return { message: GENERIC_MESSAGE, token };
  }
  return { message: GENERIC_MESSAGE };
}

async function getPasswordResetByToken(token) {
  const reset = await prisma.passwordReset.findUnique({
    where: { token: hashToken(token) },
    include: { user: { select: { id: true, email: true, status: true } } },
  });

  if (!reset || reset.usedAt) {
    throw Object.assign(new Error("Reset link is invalid or has already been used"), { status: 404 });
  }
  if (reset.expiresAt.getTime() < Date.now()) {
    throw Object.assign(new Error("Reset link has expired"), { status: 410 });
  }
  if (reset.user.status !== "ACTIVE") {
    throw Object.assign(new Error("Account is not active"), { status: 403 });
  }

  return serializeResetPreview(reset);
}

async function completePasswordReset(token, { password }) {
  const reset = await prisma.passwordReset.findUnique({
    where: { token: hashToken(token) },
    include: { user: true },
  });

  if (!reset || reset.usedAt) {
    throw Object.assign(new Error("Reset link is invalid or has already been used"), { status: 404 });
  }
  if (reset.expiresAt.getTime() < Date.now()) {
    throw Object.assign(new Error("Reset link has expired"), { status: 410 });
  }
  if (reset.user.status !== "ACTIVE") {
    throw Object.assign(new Error("Account is not active"), { status: 403 });
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: reset.userId },
      data: { password: hashedPassword },
    });

    await tx.passwordReset.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    });

    await tx.passwordReset.updateMany({
      where: { userId: reset.userId, usedAt: null, id: { not: reset.id } },
      data: { usedAt: new Date() },
    });

    return updated;
  });

  await recordAudit({
    action: "user.password_reset.completed",
    entityType: "user",
    entityId: user.id,
    actorId: user.id,
    metadata: { email: user.email },
  });

  return {
    user: authHelpers().sanitizeUser(user),
    token: authHelpers().signToken(user),
  };
}

module.exports = {
  requestPasswordReset,
  getPasswordResetByToken,
  completePasswordReset,
  GENERIC_MESSAGE,
  RESET_TTL_MS,
};
