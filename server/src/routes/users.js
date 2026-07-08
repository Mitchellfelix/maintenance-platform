const express = require("express");
const prisma = require("../lib/prisma");
const validate = require("../middleware/validate");
const { usersRead, usersUpdate } = require("../middleware/routeGuards");
const { updateUserRoleSchema } = require("../schemas/user");
const { ROLES, ROLE_LABELS, canManageRole } = require("../lib/permissions");
const { sanitizeUser } = require("../services/authService");

const router = express.Router();

router.get("/roles", ...usersRead, async (req, res) => {
  res.json({
    roles: ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
  });
});

router.get("/", ...usersRead, async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
    });
    res.json(users);
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

    res.json(sanitizeUser(user));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
