const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");

/** Authenticated route — any logged-in user. */
const anyAuth = [auth];

/** Read routes that are public today stay public; writes use these stacks. */
const sitesWrite = [auth, requirePermission("sites:write")];
const sitesDelete = [auth, requirePermission("sites:delete")];
const assetsWrite = [auth, requirePermission("assets:write")];
const assetsDelete = [auth, requirePermission("assets:delete")];
const inventoryWrite = [auth, requirePermission("inventory:write")];
const inventoryDelete = [auth, requirePermission("inventory:delete")];
const workOrdersCreate = [auth, requirePermission("workorders:create")];
const workOrdersUpdate = [auth, requirePermission("workorders:update")];
const workOrdersDelete = [auth, requirePermission("workorders:delete")];
const usersRead = [auth, requirePermission("users:read")];
const usersUpdate = [auth, requirePermission("users:update")];
const workOrdersAssign = [auth, requirePermission("workorders:assign")];
const auditRead = [auth, requirePermission("audit:read")];
const accessRequestsRead = [auth, requirePermission("access-requests:read")];
const accessRequestsReview = [auth, requirePermission("access-requests:review")];
const sopsWrite = [auth, requirePermission("sops:write")];
const sopsDelete = [auth, requirePermission("sops:delete")];
const timeEntriesWrite = [auth, requirePermission("time-entries:write")];
const timeEntriesReport = [auth, requirePermission("time-entries:report")];
const greentaggingWrite = [auth, requirePermission("greentagging:write")];
const greentaggingDelete = [auth, requirePermission("greentagging:delete")];

module.exports = {
  anyAuth,
  sitesWrite,
  sitesDelete,
  assetsWrite,
  assetsDelete,
  inventoryWrite,
  inventoryDelete,
  workOrdersCreate,
  workOrdersUpdate,
  workOrdersDelete,
  usersRead,
  usersUpdate,
  workOrdersAssign,
  auditRead,
  accessRequestsRead,
  accessRequestsReview,
  sopsWrite,
  sopsDelete,
  timeEntriesWrite,
  timeEntriesReport,
  greentaggingWrite,
  greentaggingDelete,
};
