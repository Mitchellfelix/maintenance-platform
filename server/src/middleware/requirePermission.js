const { hasPermission } = require("../lib/permissions");

/**
 * Require authentication plus a specific permission.
 * Must run after the auth middleware (or pass a user on req.user).
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "No token provided" });
    }

    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({
        error: "Forbidden",
        message: `Role ${req.user.role} cannot perform: ${permission}`,
      });
    }

    next();
  };
}

module.exports = requirePermission;
