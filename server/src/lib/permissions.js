/**
 * Role-based permissions for the EMAT Tracking Database API.
 *
 * Role mapping (UI labels):
 *   ADMIN      — full access, user/role management
 *   OPS_LEAD   — "Ops Lead": manage sites, assets, work orders for assigned locations
 *   OPERATOR   — "Operator": field work — update assigned work orders and maintain sites/assets
 *   REQUESTER  — read data, create work orders
 */

const ROLES = ["ADMIN", "OPS_LEAD", "OPERATOR", "REQUESTER"];

const ROLE_LABELS = {
  ADMIN: "Admin",
  OPS_LEAD: "Ops Lead",
  OPERATOR: "Operator",
  REQUESTER: "Requester",
};

/** Roles that are scoped to assigned sites via SiteAccess. */
const SITE_SCOPED_ROLES = ["OPS_LEAD", "OPERATOR"];

/** @type {Record<string, string[]>} */
const PERMISSIONS = {
  // Sites & assets
  "sites:read": ROLES,
  "sites:write": ["ADMIN", "OPS_LEAD", "OPERATOR"],
  "sites:delete": ["ADMIN", "OPS_LEAD"],
  "assets:read": ROLES,
  "assets:write": ["ADMIN", "OPS_LEAD", "OPERATOR"],
  "assets:delete": ["ADMIN", "OPS_LEAD"],

  // Inventory
  "inventory:read": ROLES,
  "inventory:write": ["ADMIN", "OPS_LEAD", "OPERATOR"],
  "inventory:delete": ["ADMIN", "OPS_LEAD"],

  // Work orders
  "workorders:read": ROLES,
  "workorders:create": ROLES,
  "workorders:update": ["ADMIN", "OPS_LEAD", "OPERATOR", "REQUESTER"],
  "workorders:delete": ["ADMIN", "OPS_LEAD"],
  "workorders:assign": ROLES,

  // Users (admin only)
  "users:read": ["ADMIN"],
  "users:update": ["ADMIN"],

  // Audit (admin only)
  "audit:read": ["ADMIN"],

  // Access requests
  "access-requests:create": ROLES,
  "access-requests:read": ["ADMIN", "OPS_LEAD"],
  "access-requests:review": ["ADMIN", "OPS_LEAD"],

  // Department SOPs
  "sops:read": ROLES,
  "sops:write": ["ADMIN", "OPS_LEAD"],
  "sops:delete": ["ADMIN", "OPS_LEAD"],
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

function isSiteScopedRole(role) {
  return SITE_SCOPED_ROLES.includes(role);
}

function canManageRole(actorRole, targetRole) {
  if (!ROLES.includes(targetRole)) return false;
  if (actorRole === "ADMIN") return true;
  // Ops Leads can approve access requests for non-admin roles only.
  if (actorRole === "OPS_LEAD") return targetRole !== "ADMIN";
  return false;
}

module.exports = {
  ROLES,
  ROLE_LABELS,
  SITE_SCOPED_ROLES,
  PERMISSIONS,
  hasPermission,
  hasAnyRole,
  isSiteScopedRole,
  canManageRole,
};
