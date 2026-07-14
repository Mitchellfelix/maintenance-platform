const express = require("express");
const prisma = require("../lib/prisma");
const validate = require("../middleware/validate");
const { sopsWrite, sopsDelete, sopsRead } = require("../middleware/routeGuards");
const { createSopSchema, updateSopSchema } = require("../schemas/sops");
const { recordAudit } = require("../services/auditService");

const router = express.Router();

const versionInclude = {
  publishedBy: { select: { id: true, name: true, email: true } },
};

function normalizeDocumentUrl(url) {
  if (!url) return null;
  const trimmed = url.trim();
  return trimmed || null;
}

function snapshotFromSop(sop, { changeNote, publishedById } = {}) {
  return {
    sopId: sop.id,
    version: sop.version,
    title: sop.title,
    department: sop.department,
    summary: sop.summary,
    content: sop.content,
    documentUrl: sop.documentUrl,
    changeNote: changeNote || null,
    publishedById: publishedById || null,
  };
}

function normalizeSopFields(data) {
  return {
    title: data.title,
    department: data.department,
    summary: data.summary ?? null,
    content: data.content ?? null,
    documentUrl: data.documentUrl ?? null,
    version: data.version ?? "1.0",
  };
}

function hasSopContentChanges(existing, next) {
  const before = normalizeSopFields(existing);
  const after = normalizeSopFields({ ...existing, ...next });
  return JSON.stringify(before) !== JSON.stringify(after);
}

router.get("/", ...sopsRead, async (req, res, next) => {
  try {
    const { department } = req.query;

    const sops = await prisma.sopDocument.findMany({
      where: department ? { department } : undefined,
      orderBy: [{ department: "asc" }, { title: "asc" }],
    });

    res.json(sops);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/versions", ...sopsRead, async (req, res, next) => {
  try {
    const sop = await prisma.sopDocument.findUnique({ where: { id: req.params.id } });
    if (!sop) return res.status(404).json({ error: "SOP not found" });

    const versions = await prisma.sopVersion.findMany({
      where: { sopId: req.params.id },
      include: versionInclude,
      orderBy: { createdAt: "desc" },
    });

    res.json(versions);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/versions/:versionId", ...sopsRead, async (req, res, next) => {
  try {
    const version = await prisma.sopVersion.findFirst({
      where: { id: req.params.versionId, sopId: req.params.id },
      include: versionInclude,
    });
    if (!version) return res.status(404).json({ error: "SOP version not found" });
    res.json(version);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", ...sopsRead, async (req, res, next) => {
  try {
    const sop = await prisma.sopDocument.findUnique({ where: { id: req.params.id } });
    if (!sop) return res.status(404).json({ error: "SOP not found" });
    res.json(sop);
  } catch (error) {
    next(error);
  }
});

router.post("/", ...sopsWrite, validate(createSopSchema), async (req, res, next) => {
  try {
    const data = {
      ...req.validated,
      documentUrl: normalizeDocumentUrl(req.validated.documentUrl),
    };

    const sop = await prisma.sopDocument.create({ data });

    await recordAudit({
      action: "sop.created",
      entityType: "sop_document",
      entityId: sop.id,
      actorId: req.user.id,
      metadata: { title: sop.title, department: sop.department, version: sop.version },
    });

    res.status(201).json(sop);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", ...sopsWrite, validate(updateSopSchema), async (req, res, next) => {
  try {
    const existing = await prisma.sopDocument.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "SOP not found" });

    const { changeNote, ...updates } = req.validated;
    const data = { ...updates };
    if ("documentUrl" in data) {
      data.documentUrl = normalizeDocumentUrl(data.documentUrl);
    }

    const contentChanged = hasSopContentChanges(existing, data);

    const sop = await prisma.$transaction(async (tx) => {
      if (contentChanged) {
        await tx.sopVersion.create({
          data: snapshotFromSop(existing, {
            changeNote: changeNote || "Updated procedure",
            publishedById: req.user.id,
          }),
        });
      }

      return tx.sopDocument.update({
        where: { id: req.params.id },
        data,
      });
    });

    await recordAudit({
      action: "sop.updated",
      entityType: "sop_document",
      entityId: sop.id,
      actorId: req.user.id,
      metadata: { ...updates, versionArchived: contentChanged ? existing.version : undefined },
    });

    res.json(sop);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", ...sopsDelete, async (req, res, next) => {
  try {
    const existing = await prisma.sopDocument.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "SOP not found" });

    await prisma.sopDocument.delete({ where: { id: req.params.id } });

    await recordAudit({
      action: "sop.deleted",
      entityType: "sop_document",
      entityId: req.params.id,
      actorId: req.user.id,
      metadata: { title: existing.title, department: existing.department },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
