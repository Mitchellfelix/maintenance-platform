const express = require("express");
const prisma = require("../lib/prisma");
const optionalAuth = require("../middleware/optionalAuth");
const validate = require("../middleware/validate");
const { sitesWrite, sitesDelete } = require("../middleware/routeGuards");
const { createSiteSchema, updateSiteSchema } = require("../schemas/site");
const { recordAudit } = require("../services/auditService");
const { isSiteScopedRole } = require("../lib/permissions");
const {
  getAccessibleSiteIds,
  buildSiteRecordFilter,
  assertSiteAccess,
} = require("../services/siteAccessService");

const router = express.Router();

router.get("/", optionalAuth, async (req, res, next) => {
  try {
    const siteIds = await getAccessibleSiteIds(req.user);
    const sites = await prisma.site.findMany({
      where: buildSiteRecordFilter(siteIds),
      include: { _count: { select: { assets: true, workOrders: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(sites);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", optionalAuth, async (req, res, next) => {
  try {
    const siteIds = await getAccessibleSiteIds(req.user);
    const site = await prisma.site.findFirst({
      where: { id: req.params.id, ...buildSiteRecordFilter(siteIds) },
      include: { assets: true, workOrders: true },
    });
    if (!site) return res.status(404).json({ error: "Site not found" });
    res.json(site);
  } catch (error) {
    next(error);
  }
});

router.post("/", ...sitesWrite, validate(createSiteSchema), async (req, res, next) => {
  try {
    const site = await prisma.site.create({ data: req.validated });

    await recordAudit({
      action: "site.created",
      entityType: "site",
      entityId: site.id,
      actorId: req.user.id,
      metadata: { name: site.name },
    });

    if (isSiteScopedRole(req.user.role)) {
      await prisma.siteAccess.upsert({
        where: { userId_siteId: { userId: req.user.id, siteId: site.id } },
        create: { userId: req.user.id, siteId: site.id },
        update: {},
      });
    }

    res.status(201).json(site);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", ...sitesWrite, validate(updateSiteSchema), async (req, res, next) => {
  try {
    await assertSiteAccess(req.user, req.params.id);

    const site = await prisma.site.update({
      where: { id: req.params.id },
      data: req.validated,
    });

    await recordAudit({
      action: "site.updated",
      entityType: "site",
      entityId: site.id,
      actorId: req.user.id,
      metadata: req.validated,
    });

    res.json(site);
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ error: "Forbidden", message: error.message });
    }
    next(error);
  }
});

router.delete("/:id", ...sitesDelete, async (req, res, next) => {
  try {
    await assertSiteAccess(req.user, req.params.id);

    const site = await prisma.site.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { assets: true, workOrders: true } } },
    });
    if (!site) return res.status(404).json({ error: "Site not found" });
    if (site._count.assets > 0 || site._count.workOrders > 0) {
      return res.status(409).json({ error: "Site has linked assets or work orders" });
    }

    await prisma.site.delete({ where: { id: req.params.id } });

    await recordAudit({
      action: "site.deleted",
      entityType: "site",
      entityId: req.params.id,
      actorId: req.user.id,
      metadata: { name: site.name },
    });

    res.status(204).send();
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ error: "Forbidden", message: error.message });
    }
    next(error);
  }
});

module.exports = router;
