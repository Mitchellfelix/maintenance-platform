const prisma = require("../lib/prisma");

/** Collections synced with last-write-wins by updatedAt. Order is FK-safe for apply. */
const SYNC_COLLECTIONS = [
  {
    key: "sites",
    pull: (since) =>
      prisma.site.findMany({
        where: since ? { updatedAt: { gt: since } } : undefined,
        orderBy: { updatedAt: "asc" },
      }),
    apply: async (row) => {
      const data = {
        name: row.name,
        address: row.address ?? null,
        createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
        updatedAt: new Date(row.updatedAt),
      };
      await lwwUpsert(prisma.site, row.id, data, row.updatedAt);
    },
  },
  {
    key: "assets",
    pull: (since) =>
      prisma.asset.findMany({
        where: since ? { updatedAt: { gt: since } } : undefined,
        orderBy: { updatedAt: "asc" },
      }),
    apply: async (row) => {
      if (!(await prisma.site.findUnique({ where: { id: row.siteId }, select: { id: true } }))) {
        return { skipped: true, reason: "missing_site" };
      }
      const data = {
        siteId: row.siteId,
        name: row.name,
        description: row.description ?? null,
        serialNumber: row.serialNumber ?? null,
        operationalStatus: row.operationalStatus || "OPERATIONAL",
        installedAt: row.installedAt ? new Date(row.installedAt) : null,
        createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
        updatedAt: new Date(row.updatedAt),
      };
      await lwwUpsert(prisma.asset, row.id, data, row.updatedAt);
    },
  },
  {
    key: "workOrders",
    pull: (since) =>
      prisma.workOrder.findMany({
        where: since ? { updatedAt: { gt: since } } : undefined,
        orderBy: { updatedAt: "asc" },
      }),
    apply: async (row, ctx) => {
      if (!(await prisma.site.findUnique({ where: { id: row.siteId }, select: { id: true } }))) {
        return { skipped: true, reason: "missing_site" };
      }
      const requesterId = (await userExists(row.requesterId)) ? row.requesterId : ctx.actorId;
      const assigneeId =
        row.assigneeId && (await userExists(row.assigneeId)) ? row.assigneeId : null;
      const assetId = row.assetId && (await assetExists(row.assetId)) ? row.assetId : null;
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
        updatedAt: new Date(row.updatedAt),
      };
      await lwwUpsertByUnique(prisma.workOrder, { id: row.id }, { code: row.code }, data, row.updatedAt);
    },
  },
  {
    key: "workOrderTimeEntries",
    pull: (since) =>
      prisma.workOrderTimeEntry.findMany({
        where: since ? { updatedAt: { gt: since } } : undefined,
        orderBy: { updatedAt: "asc" },
      }),
    apply: async (row, ctx) => {
      if (!(await workOrderExists(row.workOrderId))) return { skipped: true, reason: "missing_work_order" };
      const userId = (await userExists(row.userId)) ? row.userId : ctx.actorId;
      const data = {
        workOrderId: row.workOrderId,
        userId,
        hours: row.hours,
        workDate: new Date(row.workDate),
        note: row.note ?? null,
        createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
        updatedAt: new Date(row.updatedAt),
      };
      await lwwUpsert(prisma.workOrderTimeEntry, row.id, data, row.updatedAt);
    },
  },
  {
    key: "inventoryParts",
    pull: (since) =>
      prisma.inventoryPart.findMany({
        where: since ? { updatedAt: { gt: since } } : undefined,
        orderBy: { updatedAt: "asc" },
      }),
    apply: async (row) => {
      if (!(await assetExists(row.assetId))) return { skipped: true, reason: "missing_asset" };
      const data = {
        assetId: row.assetId,
        partNumber: row.partNumber,
        location: row.location,
        description: row.description ?? null,
        quantity: row.quantity ?? 1,
        createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
        updatedAt: new Date(row.updatedAt),
      };
      await lwwUpsert(prisma.inventoryPart, row.id, data, row.updatedAt);
    },
  },
  {
    key: "greenTagAssignments",
    pull: (since) =>
      prisma.greenTagAssignment.findMany({
        where: since ? { updatedAt: { gt: since } } : undefined,
        orderBy: { updatedAt: "asc" },
      }),
    apply: async (row, ctx) => {
      if (!(await assetExists(row.assetId))) return { skipped: true, reason: "missing_asset" };
      const assigneeId =
        row.assigneeId && (await userExists(row.assigneeId)) ? row.assigneeId : null;
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
        updatedAt: new Date(row.updatedAt),
      };
      await lwwUpsert(prisma.greenTagAssignment, row.id, data, row.updatedAt);
    },
  },
  {
    key: "greenTagCases",
    pull: (since) =>
      prisma.greenTagCase.findMany({
        where: since ? { updatedAt: { gt: since } } : undefined,
        orderBy: { updatedAt: "asc" },
      }),
    apply: async (row) => {
      if (!(await greenTagAssignmentExists(row.assignmentId))) {
        return { skipped: true, reason: "missing_assignment" };
      }
      const data = {
        assignmentId: row.assignmentId,
        title: row.title,
        sortOrder: row.sortOrder ?? 0,
        directions: row.directions ?? null,
        status: row.status || "OPEN",
        completedAt: row.completedAt ? new Date(row.completedAt) : null,
        createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
        updatedAt: new Date(row.updatedAt),
      };
      await lwwUpsert(prisma.greenTagCase, row.id, data, row.updatedAt);
    },
  },
  {
    key: "greenTagChecklistItems",
    pull: (since) =>
      prisma.greenTagChecklistItem.findMany({
        where: since ? { updatedAt: { gt: since } } : undefined,
        orderBy: { updatedAt: "asc" },
      }),
    apply: async (row, ctx) => {
      if (!(await greenTagAssignmentExists(row.assignmentId))) {
        return { skipped: true, reason: "missing_assignment" };
      }
      const completedById =
        row.completedById && (await userExists(row.completedById)) ? row.completedById : null;
      const data = {
        assignmentId: row.assignmentId,
        label: row.label,
        sortOrder: row.sortOrder ?? 0,
        completedAt: row.completedAt ? new Date(row.completedAt) : null,
        completedById,
        createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
        updatedAt: new Date(row.updatedAt),
      };
      await lwwUpsert(prisma.greenTagChecklistItem, row.id, data, row.updatedAt);
    },
  },
  {
    key: "standaloneChecklists",
    pull: (since) =>
      prisma.standaloneChecklist.findMany({
        where: since ? { updatedAt: { gt: since } } : undefined,
        orderBy: { updatedAt: "asc" },
      }),
    apply: async (row, ctx) => {
      const createdById =
        row.createdById && (await userExists(row.createdById)) ? row.createdById : ctx.actorId;
      const data = {
        title: row.title,
        notes: row.notes ?? null,
        createdById,
        createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
        updatedAt: new Date(row.updatedAt),
      };
      await lwwUpsert(prisma.standaloneChecklist, row.id, data, row.updatedAt);
    },
  },
  {
    key: "standaloneChecklistItems",
    pull: (since) =>
      prisma.standaloneChecklistItem.findMany({
        where: since ? { updatedAt: { gt: since } } : undefined,
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
      const data = {
        checklistId: row.checklistId,
        label: row.label,
        sortOrder: row.sortOrder ?? 0,
        completedAt: row.completedAt ? new Date(row.completedAt) : null,
        completedById,
        createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
        updatedAt: new Date(row.updatedAt),
      };
      await lwwUpsert(prisma.standaloneChecklistItem, row.id, data, row.updatedAt);
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

async function workOrderExists(id) {
  if (!id) return false;
  const row = await prisma.workOrder.findUnique({ where: { id }, select: { id: true } });
  return Boolean(row);
}

async function greenTagAssignmentExists(id) {
  if (!id) return false;
  const row = await prisma.greenTagAssignment.findUnique({ where: { id }, select: { id: true } });
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

async function lwwUpsertByUnique(delegate, idWhere, uniqueWhere, data, incomingUpdatedAt) {
  const byId = await delegate.findUnique({ where: idWhere });
  if (byId) {
    if (new Date(byId.updatedAt) >= new Date(incomingUpdatedAt)) {
      return { action: "skipped_older" };
    }
    const { createdAt, ...updateData } = data;
    await delegate.update({ where: idWhere, data: updateData });
    return { action: "updated" };
  }
  const byUnique = await delegate.findUnique({ where: uniqueWhere });
  if (byUnique) {
    // Same code, different id — keep existing row identity, update if newer.
    if (new Date(byUnique.updatedAt) >= new Date(incomingUpdatedAt)) {
      return { action: "skipped_older" };
    }
    const { createdAt, code, ...updateData } = data;
    await delegate.update({ where: { id: byUnique.id }, data: updateData });
    return { action: "updated_by_code" };
  }
  await delegate.create({ data: { id: idWhere.id, ...data } });
  return { action: "created" };
}

async function pullChanges(sinceIso) {
  const since = sinceIso ? new Date(sinceIso) : null;
  if (sinceIso && Number.isNaN(since?.getTime())) {
    throw Object.assign(new Error("Invalid since timestamp"), { status: 400 });
  }

  const payload = {};
  let newest = since;
  for (const collection of SYNC_COLLECTIONS) {
    const rows = await collection.pull(since);
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

async function applyChanges(changes, actorId) {
  const summary = {};
  const ctx = { actorId };

  for (const collection of SYNC_COLLECTIONS) {
    const rows = Array.isArray(changes?.[collection.key]) ? changes[collection.key] : [];
    let applied = 0;
    let skipped = 0;
    for (const row of rows) {
      if (!row?.id || !row?.updatedAt) {
        skipped += 1;
        continue;
      }
      try {
        const result = await collection.apply(row, ctx);
        if (result?.skipped) skipped += 1;
        else applied += 1;
      } catch (error) {
        skipped += 1;
        console.error(`sync apply ${collection.key}/${row.id}:`, error.message);
      }
    }
    summary[collection.key] = { applied, skipped, received: rows.length };
  }

  return { serverTime: new Date().toISOString(), summary };
}

module.exports = {
  SYNC_COLLECTIONS,
  pullChanges,
  applyChanges,
};
