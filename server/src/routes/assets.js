const express = require("express");
const prisma = require("../lib/prisma");
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const { createAssetSchema, updateAssetSchema } = require("../schemas/asset");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const assets = await prisma.asset.findMany({
      include: { workOrders: true, site: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(assets);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const asset = await prisma.asset.findUnique({
      where: { id: req.params.id },
      include: { workOrders: true, site: true },
    });
    if (!asset) return res.status(404).json({ error: "Asset not found" });
    res.json(asset);
  } catch (error) {
    next(error);
  }
});

router.post("/", auth, validate(createAssetSchema), async (req, res, next) => {
  try {
    const asset = await prisma.asset.create({ data: req.validated });
    res.status(201).json(asset);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", auth, validate(updateAssetSchema), async (req, res, next) => {
  try {
    const asset = await prisma.asset.update({
      where: { id: req.params.id },
      data: req.validated,
    });
    res.json(asset);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", auth, async (req, res, next) => {
  try {
    const asset = await prisma.asset.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { workOrders: true } } },
    });
    if (!asset) return res.status(404).json({ error: "Asset not found" });
    if (asset._count.workOrders > 0) {
      return res.status(409).json({ error: "Asset has linked work orders" });
    }

    await prisma.asset.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
