const { Router } = require("express");
const prisma = require("../lib/prisma");

const router = Router();

router.get("/api/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), service: "maintenance-platform" });
});

router.get("/api/health/db", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "up" });
  } catch (err) {
    console.error(err);
    res.status(503).json({ status: "degraded", database: "down" });
  }
});

router.get("/api", (req, res) => {
  res.json({
    name: "Maintenance Platform API",
    endpoints: [
      "/api/health",
      "/api/health/db",
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
