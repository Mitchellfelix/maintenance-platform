import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import ErrorBanner from "../components/ErrorBanner.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function Dashboard() {
  const { isAuthenticated } = useAuth();
  const [assets, setAssets] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      try {
        const [assetsResponse, workOrdersResponse] = await Promise.all([
          api.get("/api/assets"),
          api.get("/api/workorders"),
        ]);

        if (!isMounted) return;
        setAssets(Array.isArray(assetsResponse.data) ? assetsResponse.data : []);
        setWorkOrders(Array.isArray(workOrdersResponse.data) ? workOrdersResponse.data : []);
        setError("");
      } catch (err) {
        if (!isMounted) return;
        setAssets([]);
        setWorkOrders([]);
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
    const openStatuses = new Set(["OPEN", "IN_PROGRESS", "ON_HOLD"]);
    const openWorkOrders = workOrders.filter((order) => openStatuses.has(order.status)).length;
    const criticalWorkOrders = workOrders.filter((order) => order.priority === "CRITICAL").length;
    const downAssets = assets.filter((asset) => asset.operationalStatus !== "OPERATIONAL").length;

    return [
      { label: "Total Assets", value: assets.length },
      { label: "Open Work Orders", value: openWorkOrders },
      { label: "Critical Priority", value: criticalWorkOrders },
      { label: "Assets Needing Attention", value: downAssets },
    ];
  }, [assets, workOrders]);

  return (
    <div>
      <PageHeader
        title="Operations dashboard"
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
          <article key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{metric.label}</p>
            <p className="mt-3 text-3xl font-bold">{loading ? "..." : metric.value}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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
                <Link key={asset.id} to={`/assets/${asset.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50">
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

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold">Recent work orders</h3>
            <Link to="/workorders" className="text-sm font-medium text-emerald-700 hover:text-emerald-900">
              View all
            </Link>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
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
                    <tr key={order.id} className="hover:bg-slate-50">
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
    </div>
  );
}
