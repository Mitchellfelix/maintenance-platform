/**
 * Client-side permission checks (mirrors server/src/lib/permissions.js).
 */

const ROLES = ["ADMIN", "OPS_LEAD", "OPERATOR", "REQUESTER"];

const ROLE_LABELS = {
  ADMIN: "Admin",
  OPS_LEAD: "Ops Lead",
  OPERATOR: "Operator",
  REQUESTER: "Requester",
};

const ROLE_DESCRIPTIONS = {
  ADMIN: "Full access — manage users, approve access requests, and configure the platform.",
  OPS_LEAD:
    "Ops Lead — manage sites, assets, and work orders for assigned locations; assign work to any user, review hours by person and asset, approve access requests, and oversee operations.",
  OPERATOR:
    "Operator — perform field work: update assigned work orders, log hours, assign tasks, and maintain sites and assets within assigned locations.",
  REQUESTER: "View records, create work orders, and assign them to any active user.",
};

/** Roles available when requesting a new account. */
const REGISTRATION_ROLES = ["REQUESTER", "OPERATOR", "OPS_LEAD"];

/** Roles an active user can request when seeking elevated access. */
const ELEVATION_ROLES = ["OPERATOR", "OPS_LEAD"];

/** Roles that require site assignment. */
const SITE_SCOPED_ROLES = ["OPS_LEAD", "OPERATOR"];

const PERMISSIONS = {
  "sites:read": ROLES,
  "sites:write": ["ADMIN", "OPS_LEAD", "OPERATOR"],
  "sites:delete": ["ADMIN", "OPS_LEAD"],
  "assets:read": ROLES,
  "assets:write": ["ADMIN", "OPS_LEAD", "OPERATOR"],
  "assets:delete": ["ADMIN", "OPS_LEAD"],
  "inventory:read": ROLES,
  "inventory:write": ["ADMIN", "OPS_LEAD", "OPERATOR"],
  "inventory:delete": ["ADMIN", "OPS_LEAD"],
  "workorders:read": ROLES,
  "workorders:create": ROLES,
  "workorders:update": ["ADMIN", "OPS_LEAD", "OPERATOR", "REQUESTER"],
  "workorders:delete": ["ADMIN", "OPS_LEAD"],
  "workorders:assign": ROLES,
  "time-entries:write": ["ADMIN", "OPS_LEAD", "OPERATOR"],
  "time-entries:report": ["ADMIN", "OPS_LEAD"],
  "users:read": ["ADMIN"],
  "users:update": ["ADMIN"],
  "audit:read": ["ADMIN"],
  "access-requests:create": ROLES,
  "access-requests:read": ["ADMIN", "OPS_LEAD"],
  "access-requests:review": ["ADMIN", "OPS_LEAD"],
  "sops:read": ROLES,
  "sops:write": ["ADMIN", "OPS_LEAD"],
  "sops:delete": ["ADMIN", "OPS_LEAD"],
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

export function getRoleDescription(role) {
  return ROLE_DESCRIPTIONS[role] || "";
}

export function isSiteScopedRole(role) {
  return SITE_SCOPED_ROLES.includes(role);
}

/** Roles a user can pick when submitting an access request (excludes current role). */
export function getSelectableElevationRoles(currentRole) {
  return ELEVATION_ROLES.filter((role) => role !== currentRole);
}

/** Default role pre-selected on the elevation request form. */
export function getDefaultElevationRole(currentRole) {
  const selectable = getSelectableElevationRoles(currentRole);
  return selectable[0] || ELEVATION_ROLES[0];
}

export function canEditWorkOrder(user, workOrder) {
  if (!user || !workOrder) return false;
  if (user.role === "ADMIN" || user.role === "OPS_LEAD") return true;
  if (user.role === "OPERATOR" && workOrder.assigneeId === user.id) return true;
  if (user.role === "REQUESTER" && workOrder.requesterId === user.id) return true;
  return false;
}

export function getWorkOrderFieldAccess(role) {
  if (role === "ADMIN" || role === "OPS_LEAD") {
    return {
      title: true,
      description: true,
      status: true,
      priority: true,
      siteId: true,
      assetId: true,
      assigneeId: true,
    };
  }
  if (role === "OPERATOR") {
    return {
      title: true,
      description: true,
      status: true,
      priority: true,
      siteId: false,
      assetId: false,
      assigneeId: true,
    };
  }
  if (role === "REQUESTER") {
    return {
      title: true,
      description: true,
      status: false,
      priority: false,
      siteId: false,
      assetId: false,
      assigneeId: true,
    };
  }
  return {};
}

export {
  ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  REGISTRATION_ROLES,
  ELEVATION_ROLES,
  SITE_SCOPED_ROLES,
  PERMISSIONS,
};
