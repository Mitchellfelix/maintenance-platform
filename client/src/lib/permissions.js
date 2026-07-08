/**
 * Client-side permission checks (mirrors server/src/lib/permissions.js).
 */

const ROLES = ["ADMIN", "MANAGER", "TECHNICIAN", "REQUESTER"];

const ROLE_LABELS = {
  ADMIN: "Admin",
  MANAGER: "Operator",
  TECHNICIAN: "Technician",
  REQUESTER: "Requester",
};

const PERMISSIONS = {
  "sites:read": ROLES,
  "sites:write": ["ADMIN", "MANAGER"],
  "sites:delete": ["ADMIN", "MANAGER"],
  "assets:read": ROLES,
  "assets:write": ["ADMIN", "MANAGER"],
  "assets:delete": ["ADMIN", "MANAGER"],
  "workorders:read": ROLES,
  "workorders:create": ROLES,
  "workorders:update": ["ADMIN", "MANAGER", "TECHNICIAN", "REQUESTER"],
  "workorders:delete": ["ADMIN", "MANAGER"],
  "workorders:assign": ["ADMIN", "MANAGER"],
  "users:read": ["ADMIN"],
  "users:update": ["ADMIN"],
};

export function hasPermission(role, permission) {
  if (!role || !permission) return false;
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(role);
}

export function getRoleLabel(role) {
  return ROLE_LABELS[role] || role;
}

export { ROLES, ROLE_LABELS, PERMISSIONS };
