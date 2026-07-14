const { hasPermission } = require("../lib/permissions");
const { canEditWorkOrder } = require("./workOrderAccess");

function canLogTimeOnWorkOrder(user, workOrder) {
  if (!user || !workOrder) return false;
  if (!hasPermission(user.role, "time-entries:write")) return false;
  if (user.role === "ADMIN" || user.role === "OPS_LEAD") return true;
  // Operators log hours on work orders assigned to them.
  return canEditWorkOrder(user, workOrder);
}

function canManageTimeEntry(user, entry, workOrder) {
  if (!user || !entry || !workOrder) return false;
  if (!hasPermission(user.role, "time-entries:write")) return false;
  if (user.role === "ADMIN" || user.role === "OPS_LEAD") return true;
  return entry.userId === user.id && canEditWorkOrder(user, workOrder);
}

function canLogForOtherUsers(role) {
  return role === "ADMIN" || role === "OPS_LEAD";
}

module.exports = {
  canLogTimeOnWorkOrder,
  canManageTimeEntry,
  canLogForOtherUsers,
};
