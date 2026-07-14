const express = require("express");
const prisma = require("../lib/prisma");
const validate = require("../middleware/validate");
const { assetsWrite, assetsDelete, assetsRead } = require("../middleware/routeGuards");
const { createAssetSchema, updateAssetSchema } = require("../schemas/asset");
const { recordAudit } = require("../services/auditService");
const {
  getAccessibleSiteIds,
  buildSiteIdFilter,
  assertSiteAccess,
} = require("../services/siteAccessService");

const router = express.Router();

router.get("/", ...assetsRead, async (req, res, next) => {
  try {
    const siteIds = await getAccessibleSiteIds(req.user);
    const assets = await prisma.asset.findMany({
      where: buildSiteIdFilter(siteIds),
      include: { workOrders: true, site: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(assets);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", ...assetsRead, async (req, res, next) => {
  try {
    const siteIds = await getAccessibleSiteIds(req.user);
    const asset = await prisma.asset.findFirst({
      where: { id: req.params.id, ...buildSiteIdFilter(siteIds) },
      include: { workOrders: true, site: true },
    });
    if (!asset) return res.status(404).json({ error: "Asset not found" });
    res.json(asset);
  } catch (error) {
    next(error);
  }
});

router.post("/", ...assetsWrite, validate(createAssetSchema), async (req, res, next) => {
  try {
    await assertSiteAccess(req.user, req.validated.siteId);

    const asset = await prisma.asset.create({ data: req.validated });

    await recordAudit({
      action: "asset.created",
      entityType: "asset",
      entityId: asset.id,
      actorId: req.user.id,
      metadata: { name: asset.name, siteId: asset.siteId },
    });

    res.status(201).json(asset);
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ error: "Forbidden", message: error.message });
    }
    next(error);
  }
});

router.patch("/:id", ...assetsWrite, validate(updateAssetSchema), async (req, res, next) => {
  try {
    const existing = await prisma.asset.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Asset not found" });

    const targetSiteId = req.validated.siteId || existing.siteId;
    await assertSiteAccess(req.user, targetSiteId);

    const asset = await prisma.asset.update({
      where: { id: req.params.id },
      data: req.validated,
    });

    await recordAudit({
      action: "asset.updated",
      entityType: "asset",
      entityId: asset.id,
      actorId: req.user.id,
      metadata: req.validated,
    });

    res.json(asset);
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ error: "Forbidden", message: error.message });
    }
    next(error);
  }
});

router.delete("/:id", ...assetsDelete, async (req, res, next) => {
  try {
    const asset = await prisma.asset.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { workOrders: true } } },
    });
    if (!asset) return res.status(404).json({ error: "Asset not found" });

    await assertSiteAccess(req.user, asset.siteId);

    if (asset._count.workOrders > 0) {
      return res.status(409).json({ error: "Asset has linked work orders" });
    }

    await prisma.asset.delete({ where: { id: req.params.id } });

    await recordAudit({
      action: "asset.deleted",
      entityType: "asset",
      entityId: req.params.id,
      actorId: req.user.id,
      metadata: { name: asset.name },
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
