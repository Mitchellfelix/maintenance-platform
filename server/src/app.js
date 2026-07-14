require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const authRoutes = require("./routes/auth");
const siteRoutes = require("./routes/sites");
const assetRoutes = require("./routes/assets");
const workOrderRoutes = require("./routes/workorders");
const workOrderTimeEntryRoutes = require("./routes/workOrderTimeEntries");
const timeEntryRoutes = require("./routes/timeEntries");
const userRoutes = require("./routes/users");
const auditRoutes = require("./routes/audit");
const accessRequestRoutes = require("./routes/accessRequests");
const inventoryRoutes = require("./routes/inventory");
const sopRoutes = require("./routes/sops");
const greenTagRoutes = require("./routes/greentagging");
const checklistRoutes = require("./routes/checklists");
const { createJoinHandler, createReadyZipHandler, DOWNLOADS_DIR } = require("./routes/join");
const { ensureUploadDirs, UPLOAD_ROOT } = require("./lib/uploads");

function createApp() {
  ensureUploadDirs();
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "..", "public")));
  app.use("/uploads", express.static(UPLOAD_ROOT));

  // Preconfigured Mac download (Team URL baked in) — before static /downloads.
  app.get("/downloads/EMAT-ready.zip", createReadyZipHandler());
  app.use("/downloads", express.static(DOWNLOADS_DIR));

  // Team invite page — before the SPA catch-all.
  app.get("/join", createJoinHandler());

  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/audit-logs", auditRoutes);
  app.use("/api/access-requests", accessRequestRoutes);
  app.use("/api/sites", siteRoutes);
  app.use("/api/assets", assetRoutes);
  app.use("/api/inventory", inventoryRoutes);
  app.use("/api/sops", sopRoutes);
  app.use("/api/checklists", checklistRoutes);
  app.use("/api/greentagging", greenTagRoutes);
  app.use("/api/time-entries", timeEntryRoutes);
  app.use("/api/workorders/:workOrderId/time-entries", workOrderTimeEntryRoutes);
  app.use("/api/workorders", workOrderRoutes);
  app.use("/api/sync", require("./routes/sync"));
  app.use(routes);

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
  });

  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    console.error(err);

    if (err.code === "P2002") {
      return res.status(409).json({ error: "Duplicate value", field: err.meta?.target });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Record not found" });
    }
    if (err.code === "P2003") {
      return res.status(400).json({ error: "Related record not found" });
    }

    // Prisma / driver connection failures → unavailable, not a generic 500
    const connectionCodes = new Set([
      "P1000",
      "P1001",
      "P1002",
      "P1008",
      "P1009",
      "P1010",
      "P1011",
      "P1017",
    ]);
    if (connectionCodes.has(err.code) || /can't reach database|ECONNREFUSED|Connection refused/i.test(err.message || "")) {
      return res.status(503).json({ error: "Database unavailable. Retry in a moment." });
    }

    const status = err.status || 500;
    res.status(status).json({
      error: status === 500 ? "Internal server error" : err.message,
    });
  });

  return app;
}

module.exports = { createApp };
