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
  "audit:read": ["ADMIN"],
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

export function canEditWorkOrder(user, workOrder) {
  if (!user || !workOrder) return false;
  if (user.role === "ADMIN" || user.role === "MANAGER") return true;
  if (user.role === "TECHNICIAN" && workOrder.assigneeId === user.id) return true;
  if (user.role === "REQUESTER" && workOrder.requesterId === user.id) return true;
  return false;
}

export function getWorkOrderFieldAccess(role) {
  if (role === "ADMIN" || role === "MANAGER") {
    return { title: true, description: true, status: true, priority: true, siteId: true, assetId: true, assigneeId: true };
  }
  if (role === "TECHNICIAN") {
    return { title: true, description: true, status: true, priority: true, siteId: false, assetId: false, assigneeId: false };
  }
  if (role === "REQUESTER") {
    return { title: true, description: true, status: false, priority: false, siteId: false, assetId: false, assigneeId: false };
  }
  return {};
}

export { ROLES, ROLE_LABELS, PERMISSIONS };
