const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");

/** Authenticated route — any logged-in user. */
const anyAuth = [auth];

/** Read routes that are public today stay public; writes use these stacks. */
const sitesWrite = [auth, requirePermission("sites:write")];
const sitesDelete = [auth, requirePermission("sites:delete")];
const assetsWrite = [auth, requirePermission("assets:write")];
const assetsDelete = [auth, requirePermission("assets:delete")];
const workOrdersCreate = [auth, requirePermission("workorders:create")];
const workOrdersUpdate = [auth, requirePermission("workorders:update")];
const workOrdersDelete = [auth, requirePermission("workorders:delete")];
const usersRead = [auth, requirePermission("users:read")];
const usersUpdate = [auth, requirePermission("users:update")];

module.exports = {
  anyAuth,
  sitesWrite,
  sitesDelete,
  assetsWrite,
  assetsDelete,
  workOrdersCreate,
  workOrdersUpdate,
  workOrdersDelete,
  usersRead,
  usersUpdate,
};
