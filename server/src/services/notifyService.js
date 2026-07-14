const nodemailer = require("nodemailer");
const prisma = require("../lib/prisma");
const { ROLE_LABELS } = require("../lib/permissions");

const REVIEWER_ROLES = ["ADMIN", "OPS_LEAD"];

function appBaseUrl() {
  const configured =
    process.env.APP_URL ||
    process.env.EMAT_APP_URL ||
    `http://localhost:${process.env.PORT || 3000}`;
  return configured.replace(/\/$/, "");
}

function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}

function buildAccessRequestMessage(request) {
  const requester = request.requester || {};
  const requesterName = requester.name || requester.email || "Someone";
  const requestedRole = roleLabel(request.requestedRole);
  const reviewUrl = `${appBaseUrl()}/admin/access-requests`;
  const reason = request.reason?.trim() || "No reason provided";
  const subject = `EMAT access request: ${requesterName} → ${requestedRole}`;
  const text = [
    "A new access request needs review.",
    "",
    `Requester: ${requesterName} (${requester.email || "unknown"})`,
    `Current role: ${roleLabel(requester.role)}`,
    `Requested role: ${requestedRole}`,
    `Reason: ${reason}`,
    "",
    `Review in EMAT: ${reviewUrl}`,
  ].join("\n");

  return { subject, text, reviewUrl, requesterName, requestedRole, reason };
}

function mailConfigured() {
  if (process.env.RESEND_API_KEY && process.env.MAIL_FROM) return "resend";
  if (process.env.SMTP_HOST && process.env.MAIL_FROM) return "smtp";
  return null;
}

function slackConfigured() {
  return Boolean(process.env.SLACK_WEBHOOK_URL);
}

async function listReviewerEmails() {
  const users = await prisma.user.findMany({
    where: {
      role: { in: REVIEWER_ROLES },
      status: "ACTIVE",
    },
    select: { email: true, role: true },
  });

  return [...new Set(users.map((user) => user.email).filter(Boolean))];
}

async function sendViaResend({ to, subject, text }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to,
      subject,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend failed (${response.status}): ${body}`);
  }
}

async function sendViaSmtp({ to, subject, text }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
  });

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: to.join(", "),
    subject,
    text,
  });
}

async function sendMailTo(to, { subject, text }) {
  const provider = mailConfigured();
  if (!provider) return { skipped: true, reason: "email not configured" };

  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (recipients.length === 0) return { skipped: true, reason: "no recipients" };

  if (provider === "resend") {
    await sendViaResend({ to: recipients, subject, text });
  } else {
    await sendViaSmtp({ to: recipients, subject, text });
  }

  return { sent: true, provider, recipients: recipients.length };
}

async function sendEmail(message) {
  const to = await listReviewerEmails();
  return sendMailTo(to, message);
}

async function sendSlack(message) {
  if (!slackConfigured()) return { skipped: true, reason: "slack not configured" };

  const payload = {
    text: message.subject,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "New EMAT access request", emoji: true },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Requester:*\n${message.requesterName}` },
          { type: "mrkdwn", text: `*Requested role:*\n${message.requestedRole}` },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Reason:*\n${message.reason}` },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Review request" },
            url: message.reviewUrl,
          },
        ],
      },
    ],
  };

  const response = await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Slack webhook failed (${response.status}): ${body}`);
  }

  return { sent: true };
}

/**
 * Notify admins / ops leads (email) and optional Slack channel.
 * Never throws — access request flow must not fail because notifications fail.
 */
async function notifyAccessRequestCreated(request) {
  if (!mailConfigured() && !slackConfigured()) {
    return { skipped: true };
  }

  const message = buildAccessRequestMessage(request);
  const results = { email: null, slack: null };

  try {
    results.email = await sendEmail(message);
  } catch (err) {
    console.error("Access request email notification failed:", err.message);
    results.email = { error: err.message };
  }

  try {
    results.slack = await sendSlack(message);
  } catch (err) {
    console.error("Access request Slack notification failed:", err.message);
    results.slack = { error: err.message };
  }

  return results;
}

/**
 * Email the user when their account is ready (created or approved).
 * Never throws.
 */
async function notifyAccountReady({
  email,
  name,
  role,
  temporaryPassword,
  via = "account_created",
}) {
  if (!mailConfigured()) {
    return { skipped: true, reason: "email not configured" };
  }
  if (!email) {
    return { skipped: true, reason: "no email" };
  }

  const loginUrl = `${appBaseUrl()}/login`;
  const greeting = name ? `Hello ${name},` : "Hello,";
  const lines = [
    greeting,
    "",
    via === "access_approved"
      ? "Your EMAT Tracking Database access request was approved."
      : via === "invite_accepted"
        ? "Your EMAT Tracking Database account is ready."
        : "An EMAT Tracking Database account was created for you.",
    "",
    `Email: ${email}`,
    `Role: ${roleLabel(role)}`,
  ];

  if (temporaryPassword) {
    lines.push(`Temporary password: ${temporaryPassword}`);
    lines.push("");
    lines.push("Sign in and change this password if your team uses password resets.");
  } else if (via === "access_approved") {
    lines.push("");
    lines.push("Sign in with the password you chose when you requested access.");
  }

  lines.push("", `Sign in: ${loginUrl}`);

  try {
    return await sendMailTo(email, {
      subject:
        via === "access_approved"
          ? "EMAT access approved — you can sign in"
          : "Your EMAT Tracking Database account",
      text: lines.join("\n"),
    });
  } catch (err) {
    console.error("Account-ready email failed:", err.message);
    return { error: err.message };
  }
}

module.exports = {
  notifyAccessRequestCreated,
  notifyAccountReady,
  buildAccessRequestMessage,
  mailConfigured,
  slackConfigured,
  sendMailTo,
  appBaseUrl,
  roleLabel,
  REVIEWER_ROLES,
};
