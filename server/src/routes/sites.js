const express = require("express");
const prisma = require("../lib/prisma");
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const { createSiteSchema, updateSiteSchema } = require("../schemas/site");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const sites = await prisma.site.findMany({
      include: { _count: { select: { assets: true, workOrders: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(sites);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const site = await prisma.site.findUnique({
      where: { id: req.params.id },
      include: { assets: true, workOrders: true },
    });
    if (!site) return res.status(404).json({ error: "Site not found" });
    res.json(site);
  } catch (error) {
    next(error);
  }
});

router.post("/", auth, validate(createSiteSchema), async (req, res, next) => {
  try {
    const site = await prisma.site.create({ data: req.validated });
    res.status(201).json(site);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", auth, validate(updateSiteSchema), async (req, res, next) => {
  try {
    const site = await prisma.site.update({
      where: { id: req.params.id },
      data: req.validated,
    });
    res.json(site);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", auth, async (req, res, next) => {
  try {
    const site = await prisma.site.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { assets: true, workOrders: true } } },
    });
    if (!site) return res.status(404).json({ error: "Site not found" });
    if (site._count.assets > 0 || site._count.workOrders > 0) {
      return res.status(409).json({ error: "Site has linked assets or work orders" });
    }

    await prisma.site.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
