const express = require("express");
const { anyAuth } = require("../middleware/routeGuards");
const { pullChanges, applyChanges } = require("../services/syncService");

const router = express.Router();

router.get("/pull", ...anyAuth, async (req, res, next) => {
  try {
    const result = await pullChanges(req.query.since || null);
    res.json(result);
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

router.post("/push", ...anyAuth, async (req, res, next) => {
  try {
    const changes = req.body?.changes;
    if (!changes || typeof changes !== "object") {
      return res.status(400).json({ error: "changes object is required" });
    }
    const result = await applyChanges(changes, req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/collections", ...anyAuth, (_req, res) => {
  const { SYNC_COLLECTIONS } = require("../services/syncService");
  res.json({ collections: SYNC_COLLECTIONS.map((item) => item.key) });
});

module.exports = router;
