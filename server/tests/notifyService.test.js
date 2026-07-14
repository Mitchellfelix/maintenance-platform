/**
 * Unit tests for access-request notification helpers (no DB required).
 */

const {
  buildAccessRequestMessage,
  mailConfigured,
  slackConfigured,
} = require("../src/services/notifyService");

describe("notifyService", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("builds a review message with role labels and review URL", () => {
    process.env.APP_URL = "https://emat.example.com";

    const message = buildAccessRequestMessage({
      requestedRole: "OPS_LEAD",
      reason: "Need plant coverage",
      requester: {
        name: "Alex Operator",
        email: "alex@example.com",
        role: "REQUESTER",
      },
    });

    expect(message.subject).toContain("Alex Operator");
    expect(message.subject).toContain("Ops Lead");
    expect(message.text).toContain("Need plant coverage");
    expect(message.reviewUrl).toBe("https://emat.example.com/admin/access-requests");
  });

  it("detects Resend and SMTP configuration", () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_HOST;
    delete process.env.MAIL_FROM;
    expect(mailConfigured()).toBeNull();

    process.env.MAIL_FROM = "EMAT <emat@example.com>";
    process.env.SMTP_HOST = "smtp.example.com";
    expect(mailConfigured()).toBe("smtp");

    process.env.RESEND_API_KEY = "re_test";
    expect(mailConfigured()).toBe("resend");
  });

  it("detects Slack webhook configuration", () => {
    delete process.env.SLACK_WEBHOOK_URL;
    expect(slackConfigured()).toBe(false);

    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/T/B/X";
    expect(slackConfigured()).toBe(true);
  });
});
