const express = require("express");
const prisma = require("../lib/prisma");
const { timeEntriesReport } = require("../middleware/routeGuards");
const { getAccessibleSiteIds, buildSiteIdFilter } = require("../services/siteAccessService");

const router = express.Router();

const userSelect = { id: true, name: true, email: true, role: true };

/**
 * Hours by person and asset for Ops Lead / Admin.
 * GET /api/time-entries/summary?from=&to=&siteId=&userId=&assetId=
 */
router.get("/summary", ...timeEntriesReport, async (req, res, next) => {
  try {
    const siteIds = await getAccessibleSiteIds(req.user);
    const siteFilter = buildSiteIdFilter(siteIds);

    const { from, to, siteId, userId, assetId } = req.query;

    if (siteId) {
      if (siteFilter.siteId?.in && !siteFilter.siteId.in.includes(siteId)) {
        return res.status(403).json({ error: "Forbidden", message: "Site not in your access" });
      }
      if (Array.isArray(siteIds) && siteIds.length === 0) {
        return res.json({ rows: [], totals: { hours: 0, entries: 0 } });
      }
    }

    const workOrderWhere = {
      ...(siteId ? { siteId } : siteFilter),
      ...(assetId ? { assetId } : {}),
    };

    const workDateFilter = {};
    if (from) workDateFilter.gte = new Date(from);
    if (to) workDateFilter.lte = new Date(to);

    const entries = await prisma.workOrderTimeEntry.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(Object.keys(workDateFilter).length ? { workDate: workDateFilter } : {}),
        workOrder: workOrderWhere,
      },
      include: {
        user: { select: userSelect },
        workOrder: {
          select: {
            id: true,
            code: true,
            title: true,
            siteId: true,
            assetId: true,
            site: { select: { id: true, name: true } },
            asset: { select: { id: true, name: true, serialNumber: true } },
          },
        },
      },
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
    });

    /** Aggregate: person × asset */
    const byKey = new Map();
    for (const entry of entries) {
      const personId = entry.userId;
      const assetKey = entry.workOrder.assetId || "__none__";
      const key = `${personId}::${assetKey}`;
      const current = byKey.get(key) || {
        userId: personId,
        user: entry.user,
        assetId: entry.workOrder.assetId,
        asset: entry.workOrder.asset,
        siteId: entry.workOrder.siteId,
        site: entry.workOrder.site,
        hours: 0,
        entryCount: 0,
      };
      current.hours += entry.hours;
      current.entryCount += 1;
      byKey.set(key, current);
    }

    const rows = Array.from(byKey.values())
      .map((row) => ({
        ...row,
        hours: Math.round(row.hours * 100) / 100,
      }))
      .sort((a, b) => {
        const nameA = (a.user?.name || a.user?.email || "").toLowerCase();
        const nameB = (b.user?.name || b.user?.email || "").toLowerCase();
        if (nameA !== nameB) return nameA.localeCompare(nameB);
        const assetA = (a.asset?.name || "No asset").toLowerCase();
        const assetB = (b.asset?.name || "No asset").toLowerCase();
        return assetA.localeCompare(assetB);
      });

    const totalHours = rows.reduce((sum, row) => sum + row.hours, 0);

    res.json({
      rows,
      entries,
      totals: {
        hours: Math.round(totalHours * 100) / 100,
        entries: entries.length,
        people: new Set(rows.map((r) => r.userId)).size,
        assets: new Set(rows.map((r) => r.assetId).filter(Boolean)).size,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
