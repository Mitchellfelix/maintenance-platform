const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");

/** Authenticated route — any logged-in ACTIVE user. */
const anyAuth = [auth];

const sitesRead = [auth, requirePermission("sites:read")];
const sitesWrite = [auth, requirePermission("sites:write")];
const sitesDelete = [auth, requirePermission("sites:delete")];
const assetsRead = [auth, requirePermission("assets:read")];
const assetsWrite = [auth, requirePermission("assets:write")];
const assetsDelete = [auth, requirePermission("assets:delete")];
const inventoryRead = [auth, requirePermission("inventory:read")];
const inventoryWrite = [auth, requirePermission("inventory:write")];
const inventoryDelete = [auth, requirePermission("inventory:delete")];
const workOrdersRead = [auth, requirePermission("workorders:read")];
const workOrdersCreate = [auth, requirePermission("workorders:create")];
const workOrdersUpdate = [auth, requirePermission("workorders:update")];
const workOrdersDelete = [auth, requirePermission("workorders:delete")];
const usersRead = [auth, requirePermission("users:read")];
const usersUpdate = [auth, requirePermission("users:update")];
const workOrdersAssign = [auth, requirePermission("workorders:assign")];
const auditRead = [auth, requirePermission("audit:read")];
const accessRequestsRead = [auth, requirePermission("access-requests:read")];
const accessRequestsReview = [auth, requirePermission("access-requests:review")];
const sopsRead = [auth, requirePermission("sops:read")];
const sopsWrite = [auth, requirePermission("sops:write")];
const sopsDelete = [auth, requirePermission("sops:delete")];
const timeEntriesWrite = [auth, requirePermission("time-entries:write")];
const timeEntriesReport = [auth, requirePermission("time-entries:report")];
const greentaggingRead = [auth, requirePermission("greentagging:read")];
const greentaggingWrite = [auth, requirePermission("greentagging:write")];
const greentaggingDelete = [auth, requirePermission("greentagging:delete")];
const syncUse = [auth, requirePermission("sync:use")];
const checklistsRead = [auth, requirePermission("sops:read")]; // same read crowd

module.exports = {
  anyAuth,
  sitesRead,
  sitesWrite,
  sitesDelete,
  assetsRead,
  assetsWrite,
  assetsDelete,
  inventoryRead,
  inventoryWrite,
  inventoryDelete,
  workOrdersRead,
  workOrdersCreate,
  workOrdersUpdate,
  workOrdersDelete,
  usersRead,
  usersUpdate,
  workOrdersAssign,
  auditRead,
  accessRequestsRead,
  accessRequestsReview,
  sopsRead,
  sopsWrite,
  sopsDelete,
  timeEntriesWrite,
  timeEntriesReport,
  greentaggingRead,
  greentaggingWrite,
  greentaggingDelete,
  syncUse,
  checklistsRead,
};
