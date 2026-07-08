const express = require("express");
const prisma = require("../lib/prisma");
const { auditRead } = require("../middleware/routeGuards");

const router = express.Router();

router.get("/", ...auditRead, async (req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        actor: { select: { id: true, email: true, name: true, role: true } },
      },
    });
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
