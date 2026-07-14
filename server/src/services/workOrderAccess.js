const { hasPermission } = require("../lib/permissions");

function canEditWorkOrder(user, workOrder) {
  if (!user || !workOrder) return false;
  if (user.role === "ADMIN" || user.role === "OPS_LEAD") return true;
  if (user.role === "OPERATOR" && workOrder.assigneeId === user.id) return true;
  if (user.role === "REQUESTER" && workOrder.requesterId === user.id) return true;
  return false;
}

function filterWorkOrderUpdate(user, updates) {
  if (user.role === "ADMIN" || user.role === "OPS_LEAD") {
    return updates;
  }

  const data = { ...updates };

  if (!hasPermission(user.role, "workorders:assign")) {
    delete data.assigneeId;
  }

  if (user.role !== "ADMIN" && user.role !== "OPS_LEAD") {
    delete data.siteId;
    delete data.assetId;
  }

  if (user.role === "REQUESTER") {
    const allowed = {};
    if (data.title !== undefined) allowed.title = data.title;
    if (data.description !== undefined) allowed.description = data.description;
    if (data.assigneeId !== undefined && hasPermission(user.role, "workorders:assign")) {
      allowed.assigneeId = data.assigneeId;
    }
    return allowed;
  }

  return data;
}

module.exports = { canEditWorkOrder, filterWorkOrderUpdate };
