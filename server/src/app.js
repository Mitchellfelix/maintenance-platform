require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const authRoutes = require("./routes/auth");
const siteRoutes = require("./routes/sites");
const assetRoutes = require("./routes/assets");
const workOrderRoutes = require("./routes/workorders");
const userRoutes = require("./routes/users");
const auditRoutes = require("./routes/audit");

function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "..", "public")));

  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/audit-logs", auditRoutes);
  app.use("/api/sites", siteRoutes);
  app.use("/api/assets", assetRoutes);
  app.use("/api/workorders", workOrderRoutes);
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

    const status = err.status || 500;
    res.status(status).json({
      error: status === 500 ? "Internal server error" : err.message,
    });
  });

  return app;
}

module.exports = { createApp };
