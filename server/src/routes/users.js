const express = require("express");
const prisma = require("../lib/prisma");
const validate = require("../middleware/validate");
const { usersRead, usersUpdate, workOrdersAssign } = require("../middleware/routeGuards");
const {
  updateUserRoleSchema,
  updateUserSitesSchema,
  createUserSchema,
  createInviteSchema,
} = require("../schemas/user");
const { ROLES, ROLE_LABELS, canManageRole, isSiteScopedRole } = require("../lib/permissions");
const { sanitizeUser } = require("../services/authService");
const { recordAudit } = require("../services/auditService");
const { setUserSiteAccess } = require("../services/siteAccessService");
const {
  createUser,
  createInvite,
  listInvites,
  revokeInvite,
} = require("../services/userAdminService");

const router = express.Router();

router.get("/assignees", ...workOrdersAssign, async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: ["OPERATOR", "OPS_LEAD", "ADMIN"] } },
      orderBy: { name: "asc" },
      select: { id: true, email: true, name: true, role: true },
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
});

router.get("/roles", ...usersRead, async (req, res) => {
  res.json({
    roles: ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
  });
});

router.get("/invites", ...usersRead, async (req, res, next) => {
  try {
    const invites = await listInvites();
    res.json(invites);
  } catch (error) {
    next(error);
  }
});

router.post("/invites", ...usersUpdate, validate(createInviteSchema), async (req, res, next) => {
  try {
    const result = await createInvite(req.user, req.validated);
    res.status(201).json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

router.delete("/invites/:id", ...usersUpdate, async (req, res, next) => {
  try {
    const invite = await revokeInvite(req.user, req.params.id);
    res.json(invite);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

router.get("/", ...usersRead, async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        siteAccess: { select: { siteId: true } },
      },
    });

    res.json(
      users.map((user) => ({
        ...user,
        siteIds: user.siteAccess.map((access) => access.siteId),
        siteAccess: undefined,
      })),
    );
  } catch (error) {
    next(error);
  }
});

router.post("/", ...usersUpdate, validate(createUserSchema), async (req, res, next) => {
  try {
    const result = await createUser(req.user, req.validated);
    res.status(201).json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

router.put("/:id/sites", ...usersUpdate, validate(updateUserSitesSchema), async (req, res, next) => {
  try {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "User not found" });
    if (!isSiteScopedRole(existing.role)) {
      return res.status(400).json({ error: "Site access can only be assigned to Ops Leads and Operators" });
    }

    await setUserSiteAccess(req.params.id, req.validated.siteIds, req.user.id);
    res.json({ siteIds: req.validated.siteIds });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", ...usersUpdate, validate(updateUserRoleSchema), async (req, res, next) => {
  try {
    const { role } = req.validated;

    if (!canManageRole(req.user.role, role)) {
      return res.status(403).json({ error: "Forbidden", message: "Cannot assign this role" });
    }

    if (req.params.id === req.user.id && role !== "ADMIN") {
      return res.status(400).json({ error: "Cannot remove your own admin access" });
    }

    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "User not found" });

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
    });

    await recordAudit({
      action: "user.role.updated",
      entityType: "user",
      entityId: user.id,
      actorId: req.user.id,
      metadata: { from: existing.role, to: role, email: user.email },
    });

    res.json(sanitizeUser(user));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
