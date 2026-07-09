import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import ErrorBanner from "../components/ErrorBanner.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const OPEN_STATUSES = new Set(["OPEN", "IN_PROGRESS", "ON_HOLD"]);
const PRIORITY_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const PRIORITY_BAR_COLORS = {
  LOW: "bg-slate-400",
  MEDIUM: "bg-amber-400",
  HIGH: "bg-orange-500",
  CRITICAL: "bg-rose-500",
};

function clampPercent(value) {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function severityFillColor(percent) {
  const p = clampPercent(percent);
  if (p >= 75) return "bg-rose-500";
  if (p >= 50) return "bg-orange-500";
  if (p >= 25) return "bg-amber-400";
  return "bg-emerald-500";
}

function MetricBarTrack({ children, className = "" }) {
  return (
    <div className={`mt-4 h-2.5 overflow-hidden rounded-full bg-slate-300/80 ${className}`}>{children}</div>
  );
}

function SeverityPercentBar({ percent, label }) {
  const safePercent = clampPercent(percent);
  return (
    <div className="mt-4">
      <MetricBarTrack>
        <div
          className={`h-full rounded-full transition-all duration-500 ${severityFillColor(safePercent)}`}
          style={{ width: `${safePercent}%` }}
        />
      </MetricBarTrack>
      {label ? <p className="mt-1.5 text-xs text-slate-500">{label}</p> : null}
    </div>
  );
}

function PriorityMixBar({ segments, label }) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  if (total === 0) {
    return (
      <div className="mt-4">
        <MetricBarTrack />
        {label ? <p className="mt-1.5 text-xs text-slate-500">{label}</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-4">
      <MetricBarTrack className="flex">
        {segments.map((segment) =>
          segment.count > 0 ? (
            <div
              key={segment.priority}
              className={`h-full ${PRIORITY_BAR_COLORS[segment.priority]}`}
              style={{ width: `${(segment.count / total) * 100}%` }}
              title={`${segment.priority}: ${segment.count}`}
            />
          ) : null,
        )}
      </MetricBarTrack>
      {label ? <p className="mt-1.5 text-xs text-slate-500">{label}</p> : null}
    </div>
  );
}

function MetricCard({ metric, loading }) {
  return (
    <article className="flow-metric p-5">
      <p className="text-sm font-medium text-slate-500">{metric.label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight">{loading ? "..." : metric.value}</p>
      {!loading && metric.bar ? metric.bar : !loading && metric.bar === null ? <div className="mt-4 h-[26px]" /> : null}
    </article>
  );
}

export default function Dashboard() {
  const { isAuthenticated } = useAuth();
  const [assets, setAssets] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [sops, setSops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      try {
        const [assetsResponse, workOrdersResponse, sopsResponse] = await Promise.all([
          api.get("/api/assets"),
          api.get("/api/workorders"),
          api.get("/api/sops"),
        ]);

        if (!isMounted) return;
        setAssets(Array.isArray(assetsResponse.data) ? assetsResponse.data : []);
        setWorkOrders(Array.isArray(workOrdersResponse.data) ? workOrdersResponse.data : []);
        setSops(Array.isArray(sopsResponse.data) ? sopsResponse.data : []);
        setError("");
      } catch (err) {
        if (!isMounted) return;
        setAssets([]);
        setWorkOrders([]);
        setSops([]);
        setError(getErrorMessage(err, "Unable to load dashboard data"));
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const openOrders = workOrders.filter((order) => OPEN_STATUSES.has(order.status));
    const openWorkOrders = openOrders.length;
    const criticalWorkOrders = openOrders.filter((order) => order.priority === "CRITICAL").length;
    const downAssets = assets.filter((asset) => asset.operationalStatus !== "OPERATIONAL").length;
    const totalAssets = assets.length;

    const assetsWithOpenOrders = new Set(
      openOrders.map((order) => order.assetId).filter(Boolean),
    ).size;

    const assetsWithOpenOrdersPercent =
      totalAssets > 0 ? (assetsWithOpenOrders / totalAssets) * 100 : 0;
    const assetsNeedingAttentionPercent = totalAssets > 0 ? (downAssets / totalAssets) * 100 : 0;
    const criticalSharePercent = openWorkOrders > 0 ? (criticalWorkOrders / openWorkOrders) * 100 : 0;

    const prioritySegments = PRIORITY_ORDER.map((priority) => ({
      priority,
      count: openOrders.filter((order) => order.priority === priority).length,
    }));

    return [
      {
        label: "Total Assets",
        value: totalAssets,
        bar: null,
      },
      {
        label: "Open Work Orders",
        value: openWorkOrders,
        bar: (
          <SeverityPercentBar
            percent={assetsWithOpenOrdersPercent}
            label={`${Math.round(assetsWithOpenOrdersPercent)}% of assets with open work orders`}
          />
        ),
      },
      {
        label: "Critical Priority",
        value: criticalWorkOrders,
        bar: (
          <PriorityMixBar
            segments={prioritySegments}
            label={`${Math.round(criticalSharePercent)}% critical · open work order mix by priority`}
          />
        ),
      },
      {
        label: "Assets Needing Attention",
        value: downAssets,
        bar: (
          <SeverityPercentBar
            percent={assetsNeedingAttentionPercent}
            label={`${Math.round(assetsNeedingAttentionPercent)}% of assets non-operational`}
          />
        ),
      },
    ];
  }, [assets, workOrders]);

  return (
    <div>
      <PageHeader
        title="Operators Dashboard"
        description="Overview of assets and work orders across your maintenance program."
        action={
          !isAuthenticated ? (
            <Link to="/login" className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white">
              Sign in
            </Link>
          ) : null
        }
      />

      <ErrorBanner message={error} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} loading={loading} />
        ))}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <article className="flow-panel p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold">Recent assets</h3>
            <Link to="/assets" className="text-sm font-medium text-emerald-700 hover:text-emerald-900">
              View all
            </Link>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {loading ? <LoadingState label="Loading assets..." /> : null}
            {!loading &&
              assets.slice(0, 6).map((asset) => (
                <Link
                  key={asset.id}
                  to={`/assets/${asset.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl py-3 transition-colors duration-300 hover:bg-slate-300/40"
                >
                  <div>
                    <p className="font-medium">{asset.name}</p>
                    <p className="text-sm text-slate-500">{asset.site?.name || "Unknown site"}</p>
                  </div>
                  <StatusBadge value={asset.operationalStatus} />
                </Link>
              ))}
            {!loading && assets.length === 0 ? <p className="py-3 text-slate-500">No assets found.</p> : null}
          </div>
        </article>

        <article className="flow-panel p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold">Recent work orders</h3>
            <Link to="/workorders" className="text-sm font-medium text-emerald-700 hover:text-emerald-900">
              View all
            </Link>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-300/80">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-300/70 text-slate-600">
                <tr>
                  <th className="p-3">Code</th>
                  <th className="p-3">Title</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td className="p-3 text-slate-500" colSpan="4">
                      Loading work orders...
                    </td>
                  </tr>
                ) : null}
                {!loading &&
                  workOrders.slice(0, 8).map((order) => (
                    <tr key={order.id} className="hover:bg-slate-300/40">
                      <td className="p-3">
                        <Link to={`/workorders/${order.id}`} className="font-mono text-xs text-emerald-700">
                          {order.code}
                        </Link>
                      </td>
                      <td className="p-3 font-medium">{order.title}</td>
                      <td className="p-3">
                        <StatusBadge value={order.status} />
                      </td>
                      <td className="p-3">
                        <StatusBadge value={order.priority} />
                      </td>
                    </tr>
                  ))}
                {!loading && workOrders.length === 0 ? (
                  <tr>
                    <td className="p-3 text-slate-500" colSpan="4">
                      No work orders found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="mt-6">
        <article className="flow-panel p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold">Department SOPs</h3>
            <Link to="/sops" className="text-sm font-medium text-emerald-700 hover:text-emerald-900">
              View all
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {loading ? <LoadingState label="Loading SOPs..." /> : null}
            {!loading &&
              sops.slice(0, 6).map((sop) => (
                <Link
                  key={sop.id}
                  to={`/sops/${sop.id}`}
                  className="flow-card block p-4 transition-transform duration-300 hover:-translate-y-0.5"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{sop.department}</p>
                  <p className="mt-1 font-medium">{sop.title}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {[sop.summary, `v${sop.version}`].filter(Boolean).join(" · ")}
                  </p>
                </Link>
              ))}
            {!loading && sops.length === 0 ? (
              <p className="text-sm text-slate-500 sm:col-span-2 lg:col-span-3">
                No SOPs published yet.{" "}
                <Link to="/sops" className="font-medium text-emerald-700 hover:underline">
                  Add your first department SOP
                </Link>
                .
              </p>
            ) : null}
          </div>
        </article>
      </section>
    </div>
  );
}
