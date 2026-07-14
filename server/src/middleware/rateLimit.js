/**
 * Simple in-memory rate limiter (per process). Good enough for single Railway replica.
 */
function createRateLimiter({ windowMs, max, message }) {
  const hits = new Map();

  function prune(now) {
    for (const [key, entry] of hits) {
      if (now - entry.start >= windowMs) hits.delete(key);
    }
  }

  return function rateLimit(req, res, next) {
    const now = Date.now();
    prune(now);
    const key = `${req.ip || "unknown"}:${req.body?.email || ""}`.toLowerCase();
    let entry = hits.get(key);
    if (!entry || now - entry.start >= windowMs) {
      entry = { start: now, count: 0 };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({ error: message || "Too many requests. Try again later." });
    }
    next();
  };
}

module.exports = { createRateLimiter };
