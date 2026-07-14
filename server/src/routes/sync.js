const express = require("express");
const { syncUse } = require("../middleware/routeGuards");
const { pullChanges, applyChanges } = require("../services/syncService");

const router = express.Router();

router.get("/pull", ...syncUse, async (req, res, next) => {
  try {
    const result = await pullChanges(req.query.since || null, req.user);
    res.json(result);
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

router.post("/push", ...syncUse, async (req, res, next) => {
  try {
    const changes = req.body?.changes;
    if (!changes || typeof changes !== "object") {
      return res.status(400).json({ error: "changes object is required" });
    }
    const result = await applyChanges(changes, req.user);
    res.json(result);
  } catch (error) {
    if (error.status === 422) {
      return res.status(422).json({
        error: error.message,
        errors: error.errors,
        summary: error.summary,
      });
    }
    next(error);
  }
});

router.get("/collections", ...syncUse, (_req, res) => {
  const { SYNC_COLLECTIONS } = require("../services/syncService");
  res.json({ collections: SYNC_COLLECTIONS.map((item) => item.key) });
});

module.exports = router;
