const express = require("express");
const prisma = require("../lib/prisma");
const validate = require("../middleware/validate");
const { greentaggingWrite, greentaggingDelete, greentaggingRead } = require("../middleware/routeGuards");
const {
  createGreenTagAssignmentSchema,
  updateGreenTagAssignmentSchema,
  createGreenTagCaseSchema,
  updateGreenTagCaseSchema,
  createChecklistItemSchema,
  updateChecklistItemSchema,
} = require("../schemas/greentagging");
const { recordAudit } = require("../services/auditService");
const {
  getAccessibleSiteIds,
  buildSiteIdFilter,
  assertSiteAccess,
} = require("../services/siteAccessService");
const {
  DEFAULT_GREEN_TAG_CASES,
  DEFAULT_GREEN_TAG_CHECKLIST,
  applyStatusCompletedAt,
  missingStandardCases,
} = require("../services/greenTagDefaults");
const { handleMulterUpload, publicUrlFor, deleteUploadedFile } = require("../lib/uploads");

const router = express.Router();

const assignmentInclude = {
  asset: {
    select: {
      id: true,
      name: true,
      serialNumber: true,
      siteId: true,
      site: { select: { id: true, name: true } },
    },
  },
  assignee: { select: { id: true, name: true, email: true, role: true } },
  cases: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
  checklistItems: {
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

function buildGreenTagSiteFilter(siteIds) {
  const siteFilter = buildSiteIdFilter(siteIds);
  if (!siteFilter.siteId) return {};
  return { asset: siteFilter };
}

async function getAssignmentForUser(id, user) {
  const siteIds = await getAccessibleSiteIds(user);
  return prisma.greenTagAssignment.findFirst({
    where: { id, ...buildGreenTagSiteFilter(siteIds) },
    include: assignmentInclude,
  });
}

async function assertActiveAssignee(assigneeId) {
  if (!assigneeId) return;
  const assignee = await prisma.user.findFirst({
    where: { id: assigneeId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!assignee) {
    throw Object.assign(new Error("Assignee not found or inactive"), { status: 400 });
  }
}

function normalizeCases(cases) {
  const source = cases?.length ? cases : DEFAULT_GREEN_TAG_CASES;
  return source.map((item, index) => ({
    title: item.title.trim(),
    directions: item.directions?.trim() || null,
    sortOrder: item.sortOrder ?? index,
    status: item.status || "OPEN",
  }));
}

router.get("/", ...greentaggingRead, async (req, res, next) => {
  try {
    const siteIds = await getAccessibleSiteIds(req.user);
    const { assetId, status } = req.query;

    const assignments = await prisma.greenTagAssignment.findMany({
      where: {
        ...buildGreenTagSiteFilter(siteIds),
        ...(assetId ? { assetId } : {}),
        ...(status ? { status } : {}),
      },
      include: assignmentInclude,
      orderBy: [{ updatedAt: "desc" }],
    });

    res.json(assignments);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", ...greentaggingRead, async (req, res, next) => {
  try {
    const assignment = await getAssignmentForUser(req.params.id, req.user);
    if (!assignment) return res.status(404).json({ error: "Greentagging assignment not found" });
    res.json(assignment);
  } catch (error) {
    next(error);
  }
});

router.post("/", ...greentaggingWrite, validate(createGreenTagAssignmentSchema), async (req, res, next) => {
  try {
    const asset = await prisma.asset.findUnique({ where: { id: req.validated.assetId } });
    if (!asset) return res.status(400).json({ error: "Asset not found" });
    await assertSiteAccess(req.user, asset.siteId);
    await assertActiveAssignee(req.validated.assigneeId);

    const cases = normalizeCases(req.validated.cases);
    const checklistItems = DEFAULT_GREEN_TAG_CHECKLIST.map((item) => ({
      label: item.label,
      sortOrder: item.sortOrder,
    }));
    const status = req.validated.status || "OPEN";

    const assignment = await prisma.greenTagAssignment.create({
      data: {
        title: req.validated.title,
        summary: req.validated.summary || null,
        instructions: req.validated.instructions || null,
        assetId: req.validated.assetId,
        assigneeId: req.validated.assigneeId || null,
        status,
        dueAt: req.validated.dueAt || null,
        completedAt: status === "COMPLETED" ? new Date() : null,
        cases: { create: cases },
        checklistItems: { create: checklistItems },
      },
      include: assignmentInclude,
    });

    await recordAudit({
      action: "greentagging.created",
      entityType: "greentagging",
      entityId: assignment.id,
      actorId: req.user.id,
      metadata: { assetId: assignment.assetId, title: assignment.title, caseCount: cases.length },
    });

    res.status(201).json(assignment);
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ error: "Forbidden", message: error.message });
    }
    if (error.status === 400) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

router.patch("/:id", ...greentaggingWrite, validate(updateGreenTagAssignmentSchema), async (req, res, next) => {
  try {
    const existing = await getAssignmentForUser(req.params.id, req.user);
    if (!existing) return res.status(404).json({ error: "Greentagging assignment not found" });
    await assertSiteAccess(req.user, existing.asset.siteId);

    if (req.validated.assetId && req.validated.assetId !== existing.assetId) {
      const asset = await prisma.asset.findUnique({ where: { id: req.validated.assetId } });
      if (!asset) return res.status(400).json({ error: "Asset not found" });
      await assertSiteAccess(req.user, asset.siteId);
    }

    if (Object.prototype.hasOwnProperty.call(req.validated, "assigneeId")) {
      await assertActiveAssignee(req.validated.assigneeId);
    }

    const data = { ...req.validated };
    if (req.validated.status) {
      data.completedAt = applyStatusCompletedAt(existing.status, req.validated.status, existing.completedAt);
    }

    const assignment = await prisma.greenTagAssignment.update({
      where: { id: existing.id },
      data,
      include: assignmentInclude,
    });

    await recordAudit({
      action: "greentagging.updated",
      entityType: "greentagging",
      entityId: assignment.id,
      actorId: req.user.id,
      metadata: { changes: req.validated },
    });

    res.json(assignment);
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ error: "Forbidden", message: error.message });
    }
    if (error.status === 400) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

router.delete("/:id", ...greentaggingDelete, async (req, res, next) => {
  try {
    const existing = await getAssignmentForUser(req.params.id, req.user);
    if (!existing) return res.status(404).json({ error: "Greentagging assignment not found" });
    await assertSiteAccess(req.user, existing.asset.siteId);

    await prisma.greenTagAssignment.delete({ where: { id: existing.id } });

    await recordAudit({
      action: "greentagging.deleted",
      entityType: "greentagging",
      entityId: existing.id,
      actorId: req.user.id,
      metadata: { assetId: existing.assetId, title: existing.title },
    });

    res.status(204).send();
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ error: "Forbidden", message: error.message });
    }
    next(error);
  }
});

router.post(
  "/:id/cases",
  ...greentaggingWrite,
  validate(createGreenTagCaseSchema),
  async (req, res, next) => {
    try {
      const existing = await getAssignmentForUser(req.params.id, req.user);
      if (!existing) return res.status(404).json({ error: "Greentagging assignment not found" });
      await assertSiteAccess(req.user, existing.asset.siteId);

      const maxOrder = existing.cases.reduce((max, item) => Math.max(max, item.sortOrder), -1);
      const sortOrder = req.validated.sortOrder ?? maxOrder + 1;

      const created = await prisma.greenTagCase.create({
        data: {
          assignmentId: existing.id,
          title: req.validated.title,
          directions: req.validated.directions || null,
          sortOrder,
          status: req.validated.status || "OPEN",
        },
      });

      const assignment = await getAssignmentForUser(existing.id, req.user);

      await recordAudit({
        action: "greentagging.case.created",
        entityType: "greentagging-case",
        entityId: created.id,
        actorId: req.user.id,
        metadata: { assignmentId: existing.id, title: created.title },
      });

      res.status(201).json(assignment);
    } catch (error) {
      if (error.status === 403) {
        return res.status(403).json({ error: "Forbidden", message: error.message });
      }
      next(error);
    }
  },
);

router.post("/:id/cases/ensure-standard", ...greentaggingWrite, async (req, res, next) => {
  try {
    const existing = await getAssignmentForUser(req.params.id, req.user);
    if (!existing) return res.status(404).json({ error: "Greentagging assignment not found" });
    await assertSiteAccess(req.user, existing.asset.siteId);

    const missing = missingStandardCases(existing.cases || []);
    if (missing.length) {
      await prisma.greenTagCase.createMany({
        data: missing.map((item) => ({
          assignmentId: existing.id,
          title: item.title,
          directions: item.directions,
          sortOrder: item.sortOrder,
          status: "OPEN",
        })),
      });
    }

    const assignment = await getAssignmentForUser(existing.id, req.user);
    res.json(assignment);
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ error: "Forbidden", message: error.message });
    }
    next(error);
  }
});

router.patch(
  "/:id/cases/:caseId",
  ...greentaggingWrite,
  validate(updateGreenTagCaseSchema),
  async (req, res, next) => {
    try {
      const existing = await getAssignmentForUser(req.params.id, req.user);
      if (!existing) return res.status(404).json({ error: "Greentagging assignment not found" });
      await assertSiteAccess(req.user, existing.asset.siteId);

      const caseRow = existing.cases.find((item) => item.id === req.params.caseId);
      if (!caseRow) return res.status(404).json({ error: "Process case not found" });

      const data = { ...req.validated };
      if (req.validated.status) {
        data.completedAt = applyStatusCompletedAt(caseRow.status, req.validated.status, caseRow.completedAt);
      }

      await prisma.greenTagCase.update({
        where: { id: caseRow.id },
        data,
      });

      const assignment = await getAssignmentForUser(existing.id, req.user);

      await recordAudit({
        action: "greentagging.case.updated",
        entityType: "greentagging-case",
        entityId: caseRow.id,
        actorId: req.user.id,
        metadata: { assignmentId: existing.id, changes: req.validated },
      });

      res.json(assignment);
    } catch (error) {
      if (error.status === 403) {
        return res.status(403).json({ error: "Forbidden", message: error.message });
      }
      next(error);
    }
  },
);

router.delete("/:id/cases/:caseId", ...greentaggingDelete, async (req, res, next) => {
  try {
    const existing = await getAssignmentForUser(req.params.id, req.user);
    if (!existing) return res.status(404).json({ error: "Greentagging assignment not found" });
    await assertSiteAccess(req.user, existing.asset.siteId);

    const caseRow = existing.cases.find((item) => item.id === req.params.caseId);
    if (!caseRow) return res.status(404).json({ error: "Process case not found" });

    await prisma.greenTagCase.delete({ where: { id: caseRow.id } });

    const assignment = await getAssignmentForUser(existing.id, req.user);

    await recordAudit({
      action: "greentagging.case.deleted",
      entityType: "greentagging-case",
      entityId: caseRow.id,
      actorId: req.user.id,
      metadata: { assignmentId: existing.id, title: caseRow.title },
    });

    res.json(assignment);
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ error: "Forbidden", message: error.message });
    }
    next(error);
  }
});

router.post("/:id/checklist/seed", ...greentaggingWrite, async (req, res, next) => {
  try {
    const existing = await getAssignmentForUser(req.params.id, req.user);
    if (!existing) return res.status(404).json({ error: "Greentagging assignment not found" });
    await assertSiteAccess(req.user, existing.asset.siteId);

    if ((existing.checklistItems || []).length > 0) {
      return res.status(400).json({ error: "Checklist already has items" });
    }

    await prisma.greenTagChecklistItem.createMany({
      data: DEFAULT_GREEN_TAG_CHECKLIST.map((item) => ({
        assignmentId: existing.id,
        label: item.label,
        sortOrder: item.sortOrder,
      })),
    });

    const assignment = await getAssignmentForUser(existing.id, req.user);
    res.status(201).json(assignment);
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ error: "Forbidden", message: error.message });
    }
    next(error);
  }
});

router.post(
  "/:id/checklist",
  ...greentaggingWrite,
  validate(createChecklistItemSchema),
  async (req, res, next) => {
    try {
      const existing = await getAssignmentForUser(req.params.id, req.user);
      if (!existing) return res.status(404).json({ error: "Greentagging assignment not found" });
      await assertSiteAccess(req.user, existing.asset.siteId);

      const maxOrder = (existing.checklistItems || []).reduce(
        (max, item) => Math.max(max, item.sortOrder),
        -1,
      );

      await prisma.greenTagChecklistItem.create({
        data: {
          assignmentId: existing.id,
          label: req.validated.label,
          sortOrder: req.validated.sortOrder ?? maxOrder + 1,
        },
      });

      const assignment = await getAssignmentForUser(existing.id, req.user);

      await recordAudit({
        action: "greentagging.checklist.created",
        entityType: "greentagging-checklist",
        entityId: assignment.id,
        actorId: req.user.id,
        metadata: { assignmentId: existing.id, label: req.validated.label },
      });

      res.status(201).json(assignment);
    } catch (error) {
      if (error.status === 403) {
        return res.status(403).json({ error: "Forbidden", message: error.message });
      }
      next(error);
    }
  },
);

router.patch(
  "/:id/checklist/:itemId",
  ...greentaggingWrite,
  validate(updateChecklistItemSchema),
  async (req, res, next) => {
    try {
      const existing = await getAssignmentForUser(req.params.id, req.user);
      if (!existing) return res.status(404).json({ error: "Greentagging assignment not found" });
      await assertSiteAccess(req.user, existing.asset.siteId);

      const item = (existing.checklistItems || []).find((row) => row.id === req.params.itemId);
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

      await prisma.greenTagChecklistItem.update({
        where: { id: item.id },
        data,
      });

      const assignment = await getAssignmentForUser(existing.id, req.user);

      await recordAudit({
        action: "greentagging.checklist.updated",
        entityType: "greentagging-checklist",
        entityId: item.id,
        actorId: req.user.id,
        metadata: { assignmentId: existing.id, changes: req.validated },
      });

      res.json(assignment);
    } catch (error) {
      if (error.status === 403) {
        return res.status(403).json({ error: "Forbidden", message: error.message });
      }
      next(error);
    }
  },
);

router.delete("/:id/checklist/:itemId", ...greentaggingWrite, async (req, res, next) => {
  try {
    const existing = await getAssignmentForUser(req.params.id, req.user);
    if (!existing) return res.status(404).json({ error: "Greentagging assignment not found" });
    await assertSiteAccess(req.user, existing.asset.siteId);

    const item = (existing.checklistItems || []).find((row) => row.id === req.params.itemId);
    if (!item) return res.status(404).json({ error: "Checklist item not found" });

    for (const photo of item.photos || []) {
      deleteUploadedFile(photo.filename);
    }

    await prisma.greenTagChecklistItem.delete({ where: { id: item.id } });

    const assignment = await getAssignmentForUser(existing.id, req.user);

    await recordAudit({
      action: "greentagging.checklist.deleted",
      entityType: "greentagging-checklist",
      entityId: item.id,
      actorId: req.user.id,
      metadata: { assignmentId: existing.id, label: item.label },
    });

    res.json(assignment);
  } catch (error) {
    if (error.status === 403) {
      return res.status(403).json({ error: "Forbidden", message: error.message });
    }
    next(error);
  }
});

router.post(
  "/:id/checklist/:itemId/photos",
  ...greentaggingWrite,
  handleMulterUpload,
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Photo file is required" });
      }

      const existing = await getAssignmentForUser(req.params.id, req.user);
      if (!existing) {
        deleteUploadedFile(req.file.filename);
        return res.status(404).json({ error: "Greentagging assignment not found" });
      }
      await assertSiteAccess(req.user, existing.asset.siteId);

      const item = (existing.checklistItems || []).find((row) => row.id === req.params.itemId);
      if (!item) {
        deleteUploadedFile(req.file.filename);
        return res.status(404).json({ error: "Checklist item not found" });
      }

      await prisma.greenTagChecklistPhoto.create({
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

      const assignment = await getAssignmentForUser(existing.id, req.user);

      await recordAudit({
        action: "greentagging.checklist.photo.created",
        entityType: "greentagging-photo",
        entityId: item.id,
        actorId: req.user.id,
        metadata: {
          assignmentId: existing.id,
          checklistItemId: item.id,
          filename: req.file.filename,
        },
      });

      res.status(201).json(assignment);
    } catch (error) {
      if (req.file?.filename) deleteUploadedFile(req.file.filename);
      if (error.status === 403) {
        return res.status(403).json({ error: "Forbidden", message: error.message });
      }
      next(error);
    }
  },
);

router.delete(
  "/:id/checklist/:itemId/photos/:photoId",
  ...greentaggingWrite,
  async (req, res, next) => {
    try {
      const existing = await getAssignmentForUser(req.params.id, req.user);
      if (!existing) return res.status(404).json({ error: "Greentagging assignment not found" });
      await assertSiteAccess(req.user, existing.asset.siteId);

      const item = (existing.checklistItems || []).find((row) => row.id === req.params.itemId);
      if (!item) return res.status(404).json({ error: "Checklist item not found" });

      const photo = (item.photos || []).find((row) => row.id === req.params.photoId);
      if (!photo) return res.status(404).json({ error: "Photo not found" });

      await prisma.greenTagChecklistPhoto.delete({ where: { id: photo.id } });
      deleteUploadedFile(photo.filename);

      const assignment = await getAssignmentForUser(existing.id, req.user);

      await recordAudit({
        action: "greentagging.checklist.photo.deleted",
        entityType: "greentagging-photo",
        entityId: photo.id,
        actorId: req.user.id,
        metadata: { assignmentId: existing.id, checklistItemId: item.id },
      });

      res.json(assignment);
    } catch (error) {
      if (error.status === 403) {
        return res.status(403).json({ error: "Forbidden", message: error.message });
      }
      next(error);
    }
  },
);

module.exports = router;
