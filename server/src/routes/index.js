const { Router } = require("express");
const prisma = require("../lib/prisma");

const router = Router();

router.get("/api/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), service: "maintenance-platform" });
});

router.get("/api/health/db", async (req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "up" });
  } catch (err) {
    next(err);
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
      "/api/sites",
      "/api/assets",
      "/api/workorders",
    ],
  });
});

module.exports = router;
