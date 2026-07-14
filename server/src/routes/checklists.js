const express = require("express");
const prisma = require("../lib/prisma");
const optionalAuth = require("../middleware/optionalAuth");
const validate = require("../middleware/validate");
const { greentaggingWrite, greentaggingDelete } = require("../middleware/routeGuards");
const {
  createStandaloneChecklistSchema,
  updateStandaloneChecklistSchema,
  createStandaloneItemSchema,
  updateStandaloneItemSchema,
} = require("../schemas/standaloneChecklist");
const { recordAudit } = require("../services/auditService");
const { handleMulterUpload, publicUrlFor, deleteUploadedFile } = require("../lib/uploads");

const router = express.Router();

const checklistInclude = {
  createdBy: { select: { id: true, name: true, email: true } },
  items: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      completedBy: { select: { id: true, name: true, email: true } },
      photos: {
        orderBy: { createdAt: "asc" },
        include: {
          uploadedBy: { select: { id: true, name: true, email: true } },
        },
      },
    },
  },
};

async function getChecklist(id) {
  return prisma.standaloneChecklist.findUnique({
    where: { id },
    include: checklistInclude,
  });
}

router.get("/", optionalAuth, async (req, res, next) => {
  try {
    const checklists = await prisma.standaloneChecklist.findMany({
      include: checklistInclude,
      orderBy: { updatedAt: "desc" },
    });
    res.json(checklists);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", optionalAuth, async (req, res, next) => {
  try {
    const checklist = await getChecklist(req.params.id);
    if (!checklist) return res.status(404).json({ error: "Checklist not found" });
    res.json(checklist);
  } catch (error) {
    next(error);
  }
});

router.post("/", ...greentaggingWrite, validate(createStandaloneChecklistSchema), async (req, res, next) => {
  try {
    const items = (req.validated.items || []).map((item, index) => ({
      label: item.label,
      sortOrder: item.sortOrder ?? index,
    }));

    const checklist = await prisma.standaloneChecklist.create({
      data: {
        title: req.validated.title,
        notes: req.validated.notes || null,
        createdById: req.user.id,
        items: items.length ? { create: items } : undefined,
      },
      include: checklistInclude,
    });

    await recordAudit({
      action: "checklist.created",
      entityType: "standalone-checklist",
      entityId: checklist.id,
      actorId: req.user.id,
      metadata: { title: checklist.title, itemCount: items.length },
    });

    res.status(201).json(checklist);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", ...greentaggingWrite, validate(updateStandaloneChecklistSchema), async (req, res, next) => {
  try {
    const existing = await prisma.standaloneChecklist.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Checklist not found" });

    await prisma.standaloneChecklist.update({
      where: { id: existing.id },
      data: req.validated,
    });

    const checklist = await getChecklist(existing.id);

    await recordAudit({
      action: "checklist.updated",
      entityType: "standalone-checklist",
      entityId: existing.id,
      actorId: req.user.id,
      metadata: { changes: req.validated },
    });

    res.json(checklist);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", ...greentaggingDelete, async (req, res, next) => {
  try {
    const existing = await getChecklist(req.params.id);
    if (!existing) return res.status(404).json({ error: "Checklist not found" });

    for (const item of existing.items || []) {
      for (const photo of item.photos || []) {
        deleteUploadedFile(photo.filename);
      }
    }

    await prisma.standaloneChecklist.delete({ where: { id: existing.id } });

    await recordAudit({
      action: "checklist.deleted",
      entityType: "standalone-checklist",
      entityId: existing.id,
      actorId: req.user.id,
      metadata: { title: existing.title },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post(
  "/:id/items",
  ...greentaggingWrite,
  validate(createStandaloneItemSchema),
  async (req, res, next) => {
    try {
      const existing = await getChecklist(req.params.id);
      if (!existing) return res.status(404).json({ error: "Checklist not found" });

      const maxOrder = existing.items.reduce((max, item) => Math.max(max, item.sortOrder), -1);
      await prisma.standaloneChecklistItem.create({
        data: {
          checklistId: existing.id,
          label: req.validated.label,
          sortOrder: req.validated.sortOrder ?? maxOrder + 1,
        },
      });

      res.status(201).json(await getChecklist(existing.id));
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/:id/items/:itemId",
  ...greentaggingWrite,
  validate(updateStandaloneItemSchema),
  async (req, res, next) => {
    try {
      const existing = await getChecklist(req.params.id);
      if (!existing) return res.status(404).json({ error: "Checklist not found" });

      const item = existing.items.find((row) => row.id === req.params.itemId);
      if (!item) return res.status(404).json({ error: "Checklist item not found" });

      const data = {};
      if (req.validated.label !== undefined) data.label = req.validated.label;
      if (req.validated.sortOrder !== undefined) data.sortOrder = req.validated.sortOrder;
      if (req.validated.completed !== undefined) {
        if (req.validated.completed) {
          data.completedAt = item.completedAt || new Date();
          data.completedById = req.user.id;
        } else {
          data.completedAt = null;
          data.completedById = null;
        }
      }

      await prisma.standaloneChecklistItem.update({ where: { id: item.id }, data });
      res.json(await getChecklist(existing.id));
    } catch (error) {
      next(error);
    }
  },
);

router.delete("/:id/items/:itemId", ...greentaggingWrite, async (req, res, next) => {
  try {
    const existing = await getChecklist(req.params.id);
    if (!existing) return res.status(404).json({ error: "Checklist not found" });

    const item = existing.items.find((row) => row.id === req.params.itemId);
    if (!item) return res.status(404).json({ error: "Checklist item not found" });

    for (const photo of item.photos || []) {
      deleteUploadedFile(photo.filename);
    }

    await prisma.standaloneChecklistItem.delete({ where: { id: item.id } });
    res.json(await getChecklist(existing.id));
  } catch (error) {
    next(error);
  }
});

router.post(
  "/:id/items/:itemId/photos",
  ...greentaggingWrite,
  handleMulterUpload,
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Photo file is required" });

      const existing = await getChecklist(req.params.id);
      if (!existing) {
        deleteUploadedFile(req.file.filename);
        return res.status(404).json({ error: "Checklist not found" });
      }

      const item = existing.items.find((row) => row.id === req.params.itemId);
      if (!item) {
        deleteUploadedFile(req.file.filename);
        return res.status(404).json({ error: "Checklist item not found" });
      }

      await prisma.standaloneChecklistPhoto.create({
        data: {
          checklistItemId: item.id,
          url: publicUrlFor(req.file.filename),
          filename: req.file.filename,
          originalName: req.file.originalname || req.file.filename,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
          uploadedById: req.user.id,
        },
      });

      res.status(201).json(await getChecklist(existing.id));
    } catch (error) {
      if (req.file?.filename) deleteUploadedFile(req.file.filename);
      next(error);
    }
  },
);

router.delete(
  "/:id/items/:itemId/photos/:photoId",
  ...greentaggingWrite,
  async (req, res, next) => {
    try {
      const existing = await getChecklist(req.params.id);
      if (!existing) return res.status(404).json({ error: "Checklist not found" });

      const item = existing.items.find((row) => row.id === req.params.itemId);
      if (!item) return res.status(404).json({ error: "Checklist item not found" });

      const photo = (item.photos || []).find((row) => row.id === req.params.photoId);
      if (!photo) return res.status(404).json({ error: "Photo not found" });

      await prisma.standaloneChecklistPhoto.delete({ where: { id: photo.id } });
      deleteUploadedFile(photo.filename);

      res.json(await getChecklist(existing.id));
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
