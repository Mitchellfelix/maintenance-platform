const prisma = require("../lib/prisma");
const { getAccessibleSiteIds } = require("./siteAccessService");

const NO_ACCESS = "__no_site_access__";
const FUTURE_SKEW_MS = 5 * 60 * 1000;

function sinceClause(since) {
  return since ? { updatedAt: { gt: since } } : {};
}

function siteIdIn(siteIds) {
  if (siteIds === null) return {};
  return { siteId: { in: siteIds.length > 0 ? siteIds : [NO_ACCESS] } };
}

function siteRecordIn(siteIds) {
  if (siteIds === null) return {};
  return { id: { in: siteIds.length > 0 ? siteIds : [NO_ACCESS] } };
}

function normalizeUpdatedAt(incoming) {
  const stamp = new Date(incoming);
  if (Number.isNaN(stamp.getTime())) {
    throw Object.assign(new Error("Invalid updatedAt"), { status: 400 });
  }
  const now = Date.now();
  if (stamp.getTime() > now + FUTURE_SKEW_MS) {
    return new Date(now);
  }
  return stamp;
}

function denySite(ctx, siteId) {
  if (ctx.siteIds === null) return null;
  if (!siteId || !ctx.siteIds.includes(siteId)) {
    return { error: true, reason: "forbidden_site" };
  }
  return null;
}

/** Collections synced with last-write-wins by updatedAt. Order is FK-safe for apply. */
const SYNC_COLLECTIONS = [
  {
    key: "sites",
    pull: (since, siteIds) =>
      prisma.site.findMany({
        where: { ...sinceClause(since), ...siteRecordIn(siteIds) },
        orderBy: { updatedAt: "asc" },
      }),
    apply: async (row, ctx) => {
      const denied = denySite(ctx, row.id);
      if (denied) return denied;
      const updatedAt = normalizeUpdatedAt(row.updatedAt);
      const data = {
        name: row.name,
        address: row.address ?? null,
        createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
        updatedAt,
      };
      return lwwUpsert(prisma.site, row.id, data, updatedAt);
    },
  },
  {
    key: "assets",
    pull: (since, siteIds) =>
      prisma.asset.findMany({
        where: { ...sinceClause(since), ...siteIdIn(siteIds) },
        orderBy: { updatedAt: "asc" },
      }),
    apply: async (row, ctx) => {
      const denied = denySite(ctx, row.siteId);
      if (denied) return denied;
      if (!(await prisma.site.findUnique({ where: { id: row.siteId }, select: { id: true } }))) {
        return { skipped: true, reason: "missing_site" };
      }
      const updatedAt = normalizeUpdatedAt(row.updatedAt);
      const data = {
        siteId: row.siteId,
        name: row.name,
        description: row.description ?? null,
        serialNumber: row.serialNumber ?? null,
        operationalStatus: row.operationalStatus || "OPERATIONAL",
        installedAt: row.installedAt ? new Date(row.installedAt) : null,
        createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
        updatedAt,
      };
      return lwwUpsert(prisma.asset, row.id, data, updatedAt);
    },
  },
  {
    key: "workOrders",
    pull: (since, siteIds) =>
      prisma.workOrder.findMany({
        where: { ...sinceClause(since), ...siteIdIn(siteIds) },
        orderBy: { updatedAt: "asc" },
      }),
    apply: async (row, ctx) => {
      const denied = denySite(ctx, row.siteId);
      if (denied) return denied;
      if (!(await prisma.site.findUnique({ where: { id: row.siteId }, select: { id: true } }))) {
        return { skipped: true, reason: "missing_site" };
      }
      const requesterId = (await userExists(row.requesterId)) ? row.requesterId : ctx.actorId;
      const assigneeId =
        row.assigneeId && (await userExists(row.assigneeId)) ? row.assigneeId : null;
      const assetId = row.assetId && (await assetExists(row.assetId)) ? row.assetId : null;
      const updatedAt = normalizeUpdatedAt(row.updatedAt);
      const data = {
        code: row.code,
        title: row.title,
        description: row.description ?? null,
        status: row.status || "OPEN",
        priority: row.priority || "MEDIUM",
        siteId: row.siteId,
        assetId,
        requesterId,
        assigneeId,
        dueAt: row.dueAt ? new Date(row.dueAt) : null,
        startedAt: row.startedAt ? new Date(row.startedAt) : null,
        completedAt: row.completedAt ? new Date(row.completedAt) : null,
        createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
        updatedAt,
      };
      return lwwUpsertWorkOrder(row.id, row.code, data, updatedAt);
    },
  },
  {
    key: "workOrderTimeEntries",
    pull: (since, siteIds) =>
      prisma.workOrderTimeEntry.findMany({
        where: {
          ...sinceClause(since),
          ...(siteIds === null ? {} : { workOrder: siteIdIn(siteIds) }),
        },
        orderBy: { updatedAt: "asc" },
      }),
    apply: async (row, ctx) => {
      const workOrder = await prisma.workOrder.findUnique({
        where: { id: row.workOrderId },
        select: { id: true, siteId: true },
      });
      if (!workOrder) return { skipped: true, reason: "missing_work_order" };
      const denied = denySite(ctx, workOrder.siteId);
      if (denied) return denied;
      const userId = (await userExists(row.userId)) ? row.userId : ctx.actorId;
      const updatedAt = normalizeUpdatedAt(row.updatedAt);
      const data = {
        workOrderId: row.workOrderId,
        userId,
        hours: row.hours,
        workDate: new Date(row.workDate),
        note: row.note ?? null,
        createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
        updatedAt,
      };
      return lwwUpsert(prisma.workOrderTimeEntry, row.id, data, updatedAt);
    },
  },
  {
    key: "inventoryParts",
    pull: (since, siteIds) =>
      prisma.inventoryPart.findMany({
        where: {
          ...sinceClause(since),
          ...(siteIds === null ? {} : { asset: siteIdIn(siteIds) }),
        },
        orderBy: { updatedAt: "asc" },
      }),
    apply: async (row, ctx) => {
      const asset = await prisma.asset.findUnique({
        where: { id: row.assetId },
        select: { id: true, siteId: true },
      });
      if (!asset) return { skipped: true, reason: "missing_asset" };
      const denied = denySite(ctx, asset.siteId);
      if (denied) return denied;
      const updatedAt = normalizeUpdatedAt(row.updatedAt);
      const data = {
        assetId: row.assetId,
        partNumber: row.partNumber,
        location: row.location,
        description: row.description ?? null,
        quantity: row.quantity ?? 1,
        createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
        updatedAt,
      };
      return lwwUpsert(prisma.inventoryPart, row.id, data, updatedAt);
    },
  },
  {
    key: "greenTagAssignments",
    pull: (since, siteIds) =>
      prisma.greenTagAssignment.findMany({
        where: {
          ...sinceClause(since),
          ...(siteIds === null ? {} : { asset: siteIdIn(siteIds) }),
        },
        orderBy: { updatedAt: "asc" },
      }),
    apply: async (row, ctx) => {
      const asset = await prisma.asset.findUnique({
        where: { id: row.assetId },
        select: { id: true, siteId: true },
      });
      if (!asset) return { skipped: true, reason: "missing_asset" };
      const denied = denySite(ctx, asset.siteId);
      if (denied) return denied;
      const assigneeId =
        row.assigneeId && (await userExists(row.assigneeId)) ? row.assigneeId : null;
      const updatedAt = normalizeUpdatedAt(row.updatedAt);
      const data = {
        title: row.title,
        summary: row.summary ?? null,
        instructions: row.instructions ?? null,
        status: row.status || "OPEN",
        assetId: row.assetId,
        assigneeId,
        dueAt: row.dueAt ? new Date(row.dueAt) : null,
        completedAt: row.completedAt ? new Date(row.completedAt) : null,
        createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
        updatedAt,
      };
      return lwwUpsert(prisma.greenTagAssignment, row.id, data, updatedAt);
    },
  },
  {
    key: "greenTagCases",
    pull: (since, siteIds) =>
      prisma.greenTagCase.findMany({
        where: {
          ...sinceClause(since),
          ...(siteIds === null
            ? {}
            : { assignment: { asset: siteIdIn(siteIds) } }),
        },
        orderBy: { updatedAt: "asc" },
      }),
    apply: async (row, ctx) => {
      const assignment = await prisma.greenTagAssignment.findUnique({
        where: { id: row.assignmentId },
        select: { id: true, asset: { select: { siteId: true } } },
      });
      if (!assignment) return { skipped: true, reason: "missing_assignment" };
      const denied = denySite(ctx, assignment.asset?.siteId);
      if (denied) return denied;
      const updatedAt = normalizeUpdatedAt(row.updatedAt);
      const data = {
        assignmentId: row.assignmentId,
        title: row.title,
        sortOrder: row.sortOrder ?? 0,
        directions: row.directions ?? null,
        status: row.status || "OPEN",
        completedAt: row.completedAt ? new Date(row.completedAt) : null,
        createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
        updatedAt,
      };
      return lwwUpsert(prisma.greenTagCase, row.id, data, updatedAt);
    },
  },
  {
    key: "greenTagChecklistItems",
    pull: (since, siteIds) =>
      prisma.greenTagChecklistItem.findMany({
        where: {
          ...sinceClause(since),
          ...(siteIds === null
            ? {}
            : { assignment: { asset: siteIdIn(siteIds) } }),
        },
        orderBy: { updatedAt: "asc" },
      }),
    apply: async (row, ctx) => {
      const assignment = await prisma.greenTagAssignment.findUnique({
        where: { id: row.assignmentId },
        select: { id: true, asset: { select: { siteId: true } } },
      });
      if (!assignment) return { skipped: true, reason: "missing_assignment" };
      const denied = denySite(ctx, assignment.asset?.siteId);
      if (denied) return denied;
      const completedById =
        row.completedById && (await userExists(row.completedById)) ? row.completedById : null;
      const updatedAt = normalizeUpdatedAt(row.updatedAt);
      const data = {
        assignmentId: row.assignmentId,
        label: row.label,
        sortOrder: row.sortOrder ?? 0,
        completedAt: row.completedAt ? new Date(row.completedAt) : null,
        completedById,
        createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
        updatedAt,
      };
      return lwwUpsert(prisma.greenTagChecklistItem, row.id, data, updatedAt);
    },
  },
  {
    key: "standaloneChecklists",
    pull: (since) =>
      prisma.standaloneChecklist.findMany({
        where: sinceClause(since),
        orderBy: { updatedAt: "asc" },
      }),
    apply: async (row, ctx) => {
      const createdById =
        row.createdById && (await userExists(row.createdById)) ? row.createdById : ctx.actorId;
      const updatedAt = normalizeUpdatedAt(row.updatedAt);
      const data = {
        title: row.title,
        notes: row.notes ?? null,
        createdById,
        createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
        updatedAt,
      };
      return lwwUpsert(prisma.standaloneChecklist, row.id, data, updatedAt);
    },
  },
  {
    key: "standaloneChecklistItems",
    pull: (since) =>
      prisma.standaloneChecklistItem.findMany({
        where: sinceClause(since),
        orderBy: { updatedAt: "asc" },
      }),
    apply: async (row) => {
      const parent = await prisma.standaloneChecklist.findUnique({
        where: { id: row.checklistId },
        select: { id: true },
      });
      if (!parent) return { skipped: true, reason: "missing_checklist" };
      const completedById =
        row.completedById && (await userExists(row.completedById)) ? row.completedById : null;
      const updatedAt = normalizeUpdatedAt(row.updatedAt);
      const data = {
        checklistId: row.checklistId,
        label: row.label,
        sortOrder: row.sortOrder ?? 0,
        completedAt: row.completedAt ? new Date(row.completedAt) : null,
        completedById,
        createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
        updatedAt,
      };
      return lwwUpsert(prisma.standaloneChecklistItem, row.id, data, updatedAt);
    },
  },
];

async function userExists(id) {
  if (!id) return false;
  const row = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  return Boolean(row);
}

async function assetExists(id) {
  if (!id) return false;
  const row = await prisma.asset.findUnique({ where: { id }, select: { id: true } });
  return Boolean(row);
}

async function lwwUpsert(delegate, id, data, incomingUpdatedAt) {
  const existing = await delegate.findUnique({ where: { id } });
  if (!existing) {
    await delegate.create({ data: { id, ...data } });
    return { action: "created" };
  }
  if (new Date(existing.updatedAt) >= new Date(incomingUpdatedAt)) {
    return { action: "skipped_older" };
  }
  const { createdAt, ...updateData } = data;
  await delegate.update({ where: { id }, data: updateData });
  return { action: "updated" };
}

/** Upsert work orders by id only — never merge distinct rows that share a code. */
async function lwwUpsertWorkOrder(id, code, data, incomingUpdatedAt) {
  const byId = await prisma.workOrder.findUnique({ where: { id } });
  if (byId) {
    if (new Date(byId.updatedAt) >= new Date(incomingUpdatedAt)) {
      return { action: "skipped_older" };
    }
    const { createdAt, ...updateData } = data;
    await prisma.workOrder.update({ where: { id }, data: updateData });
    return { action: "updated" };
  }

  if (code) {
    const byCode = await prisma.workOrder.findUnique({ where: { code } });
    if (byCode && byCode.id !== id) {
      return { error: true, reason: "code_conflict" };
    }
  }

  await prisma.workOrder.create({ data: { id, ...data } });
  return { action: "created" };
}

async function pullChanges(sinceIso, user) {
  const since = sinceIso ? new Date(sinceIso) : null;
  if (sinceIso && Number.isNaN(since?.getTime())) {
    throw Object.assign(new Error("Invalid since timestamp"), { status: 400 });
  }

  const siteIds = await getAccessibleSiteIds(user);
  const payload = {};
  let newest = since;
  for (const collection of SYNC_COLLECTIONS) {
    const rows = await collection.pull(since, siteIds);
    payload[collection.key] = rows;
    for (const row of rows) {
      const stamp = row.updatedAt ? new Date(row.updatedAt) : null;
      if (stamp && (!newest || stamp > newest)) newest = stamp;
    }
  }

  return {
    serverTime: new Date().toISOString(),
    since: sinceIso || null,
    nextSince: (newest || new Date()).toISOString(),
    changes: payload,
  };
}

async function applyChanges(changes, user) {
  const siteIds = await getAccessibleSiteIds(user);
  const ctx = { actorId: user.id, siteIds };
  const summary = {};
  const errors = [];

  for (const collection of SYNC_COLLECTIONS) {
    const rows = Array.isArray(changes?.[collection.key]) ? changes[collection.key] : [];
    let applied = 0;
    let skipped = 0;
    for (const row of rows) {
      if (!row?.id || !row?.updatedAt) {
        skipped += 1;
        errors.push({ collection: collection.key, id: row?.id || null, reason: "invalid_row" });
        continue;
      }
      try {
        const result = await collection.apply(row, ctx);
        if (result?.error) {
          skipped += 1;
          errors.push({
            collection: collection.key,
            id: row.id,
            reason: result.reason || "apply_error",
          });
        } else if (result?.skipped) {
          skipped += 1;
        } else {
          applied += 1;
        }
      } catch (error) {
        skipped += 1;
        errors.push({
          collection: collection.key,
          id: row.id,
          reason: error.message || "apply_exception",
        });
        console.error(`sync apply ${collection.key}/${row.id}:`, error.message);
      }
    }
    summary[collection.key] = { applied, skipped, received: rows.length };
  }

  if (errors.length > 0) {
    throw Object.assign(new Error("One or more sync changes failed"), {
      status: 422,
      errors,
      summary,
    });
  }

  return { serverTime: new Date().toISOString(), summary };
}

module.exports = {
  SYNC_COLLECTIONS,
  pullChanges,
  applyChanges,
};
