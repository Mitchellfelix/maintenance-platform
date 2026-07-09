const express = require("express");
const prisma = require("../lib/prisma");
const optionalAuth = require("../middleware/optionalAuth");
const validate = require("../middleware/validate");
const { inventoryWrite, inventoryDelete } = require("../middleware/routeGuards");
const { createInventoryPartSchema, updateInventoryPartSchema } = require("../schemas/inventory");
const { recordAudit } = require("../services/auditService");
const {
  getAccessibleSiteIds,
  buildSiteIdFilter,
  assertSiteAccess,
} = require("../services/siteAccessService");

const router = express.Router();

const inventoryInclude = {
  asset: {
    select: {
      id: true,
      name: true,
      serialNumber: true,
      siteId: true,
      site: { select: { id: true, name: true } },
    },
  },
};

function buildInventorySiteFilter(siteIds) {
  const siteFilter = buildSiteIdFilter(siteIds);
  if (!siteFilter.siteId) {
    return {};
  }

  return { asset: siteFilter };
}

async function getInventoryPartForUser(id, user) {
  const siteIds = await getAccessibleSiteIds(user);
  return prisma.inventoryPart.findFirst({
    where: { id, ...buildInventorySiteFilter(siteIds) },
    include: inventoryInclude,
  });
}

router.get("/", optionalAuth, async (req, res, next) => {
  try {
    const siteIds = await getAccessibleSiteIds(req.user);
    const { assetId } = req.query;

    const parts = await prisma.inventoryPart.findMany({
      where: {
        ...buildInventorySiteFilter(siteIds),
        ...(assetId ? { assetId } : {}),
      },
      include: inventoryInclude,
      orderBy: [{ asset: { name: "asc" } }, { partNumber: "asc" }],
    });

    res.json(parts);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", optionalAuth, async (req, res, next) => {
  try {
    const part = await getInventoryPartForUser(req.params.id, req.user);
    if (!part) return res.status(404).json({ error: "Inventory part not found" });
    res.json(part);
  } catch (error) {
    next(error);
  }
});

router.post("/", ...inventoryWrite, validate(createInventoryPartSchema), async (req, res, next) => {
  try {
    const asset = await prisma.asset.findUnique({ where: { id: req.validated.assetId } });
    if (!asset) return res.status(400).json({ error: "Asset not found" });

    await assertSiteAccess(req.user, asset.siteId);

    const part = await prisma.inventoryPart.create({
      data: req.validated,
      include: inventoryInclude,
    });

    await recordAudit({
      action: "inventory.created",
      entityType: "inventory_part",
      entityId: part.id,
      actorId: req.user.id,
      metadata: {
        partNumber: part.partNumber,
        location: part.location,
        assetId: part.assetId,
      },
    });

    res.status(201).json(part);
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ error: "Forbidden", message: error.message });
    }
    next(error);
  }
});

router.patch("/:id", ...inventoryWrite, validate(updateInventoryPartSchema), async (req, res, next) => {
  try {
    const existing = await getInventoryPartForUser(req.params.id, req.user);
    if (!existing) return res.status(404).json({ error: "Inventory part not found" });

    const targetAssetId = req.validated.assetId || existing.assetId;
    const asset = await prisma.asset.findUnique({ where: { id: targetAssetId } });
    if (!asset) return res.status(400).json({ error: "Asset not found" });

    await assertSiteAccess(req.user, asset.siteId);

    const part = await prisma.inventoryPart.update({
      where: { id: req.params.id },
      data: req.validated,
      include: inventoryInclude,
    });

    await recordAudit({
      action: "inventory.updated",
      entityType: "inventory_part",
      entityId: part.id,
      actorId: req.user.id,
      metadata: req.validated,
    });

    res.json(part);
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ error: "Forbidden", message: error.message });
    }
    next(error);
  }
});

router.delete("/:id", ...inventoryDelete, async (req, res, next) => {
  try {
    const existing = await getInventoryPartForUser(req.params.id, req.user);
    if (!existing) return res.status(404).json({ error: "Inventory part not found" });

    await assertSiteAccess(req.user, existing.asset.siteId);

    await prisma.inventoryPart.delete({ where: { id: req.params.id } });

    await recordAudit({
      action: "inventory.deleted",
      entityType: "inventory_part",
      entityId: req.params.id,
      actorId: req.user.id,
      metadata: { partNumber: existing.partNumber, assetId: existing.assetId },
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
