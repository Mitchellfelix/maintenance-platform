const { Router } = require("express");
const prisma = require("../lib/prisma");
const { getAppVersion } = require("../lib/version");

const router = Router();

router.get("/api/health", (req, res) => {
  const app = getAppVersion();
  res.json({
    status: "ok",
    uptime: process.uptime(),
    service: "maintenance-platform",
    version: app.version,
  });
});

router.get("/api/health/db", async (req, res) => {
  const app = getAppVersion();
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "up", version: app.version });
  } catch (err) {
    console.error(err);
    res.status(503).json({ status: "degraded", database: "down", version: app.version });
  }
});

router.get("/api/version", (req, res) => {
  res.json(getAppVersion());
});

router.get("/api", (req, res) => {
  const app = getAppVersion();
  res.json({
    name: "Maintenance Platform API",
    version: app.version,
    endpoints: [
      "/api/health",
      "/api/health/db",
      "/api/version",
      "/api/auth/register",
      "/api/auth/login",
      "/api/auth/me",
      "/api/auth/password-reset",
      "/api/auth/invites/:token",
      "/api/users",
      "/api/users/assignees",
      "/api/users/roles",
      "/api/users/invites",
      "/api/audit-logs",
      "/api/access-requests",
      "/api/access-requests/mine",
      "/api/sites",
      "/api/assets",
      "/api/inventory",
      "/api/workorders",
    ],
  });
});

module.exports = router;
