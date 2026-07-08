/**
 * Role-based permissions for the Maintenance Platform API.
 *
 * Role mapping (UI labels):
 *   ADMIN      — full access, user/role management
 *   MANAGER    — "Operator": manage sites, assets, work orders
 *   TECHNICIAN — update assigned work, add notes
 *   REQUESTER  — read data, create work orders
 */

const ROLES = ["ADMIN", "MANAGER", "TECHNICIAN", "REQUESTER"];

const ROLE_LABELS = {
  ADMIN: "Admin",
  MANAGER: "Operator",
  TECHNICIAN: "Technician",
  REQUESTER: "Requester",
};

/** @type {Record<string, string[]>} */
const PERMISSIONS = {
  // Sites & assets
  "sites:read": ROLES,
  "sites:write": ["ADMIN", "MANAGER"],
  "sites:delete": ["ADMIN", "MANAGER"],
  "assets:read": ROLES,
  "assets:write": ["ADMIN", "MANAGER"],
  "assets:delete": ["ADMIN", "MANAGER"],

  // Work orders
  "workorders:read": ROLES,
  "workorders:create": ROLES,
  "workorders:update": ["ADMIN", "MANAGER", "TECHNICIAN", "REQUESTER"],
  "workorders:delete": ["ADMIN", "MANAGER"],
  "workorders:assign": ["ADMIN", "MANAGER"],

  // Users (admin only)
  "users:read": ["ADMIN"],
  "users:update": ["ADMIN"],
};

function hasPermission(role, permission) {
  if (!role || !permission) return false;
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(role);
}

function hasAnyRole(role, allowedRoles) {
  if (!role || !allowedRoles?.length) return false;
  return allowedRoles.includes(role);
}

function canManageRole(actorRole, targetRole) {
  if (actorRole !== "ADMIN") return false;
  return ROLES.includes(targetRole);
}

module.exports = {
  ROLES,
  ROLE_LABELS,
  PERMISSIONS,
  hasPermission,
  hasAnyRole,
  canManageRole,
};
