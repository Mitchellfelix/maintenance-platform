import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import FormField from "../components/FormField.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader, { EmptyState, RecordLink } from "../components/PageHeader.jsx";

const priorityOptions = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

const emptyForm = {
  title: "",
  description: "",
  siteId: "",
  assetId: "",
  priority: "MEDIUM",
};

export default function WorkOrdersPage() {
  const { isAuthenticated, can } = useAuth();
  const [workOrders, setWorkOrders] = useState([]);
  const [sites, setSites] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [ordersResponse, sitesResponse, assetsResponse] = await Promise.all([
        api.get("/api/workorders"),
        api.get("/api/sites"),
        api.get("/api/assets"),
      ]);
      setWorkOrders(ordersResponse.data);
      setSites(sitesResponse.data);
      setAssets(assetsResponse.data);
      if (!form.siteId && sitesResponse.data[0]) {
        setForm((current) => ({ ...current, siteId: sitesResponse.data[0].id }));
      }
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load work orders"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const siteAssets = assets.filter((asset) => asset.siteId === form.siteId);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === "siteId") {
        next.assetId = "";
      }
      return next;
    });
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        siteId: form.siteId,
        priority: form.priority,
        assetId: form.assetId || undefined,
      };
      await api.post("/api/workorders", payload);
      setForm((current) => ({ ...emptyForm, siteId: current.siteId }));
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to create work order"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Work Orders"
        description="Create and track maintenance tasks across sites and assets."
        action={
          !isAuthenticated ? (
            <Link to="/login" className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white">
              Sign in to create
            </Link>
          ) : !can("workorders:create") ? (
            <span className="text-sm text-slate-500">Sign in to create work orders</span>
          ) : null
        }
      />

      <ErrorBanner message={error} />

      {isAuthenticated && can("workorders:create") ? (
        <form className="mb-6 grid gap-4 rounded-3xl border border-slate-300 bg-slate-200 p-6 shadow-sm md:grid-cols-2" onSubmit={handleCreate}>
          <FormField label="Title" name="title" value={form.title} onChange={updateField} required />
          <FormField
            label="Priority"
            name="priority"
            as="select"
            value={form.priority}
            onChange={updateField}
            options={priorityOptions}
          />
          <FormField
            label="Site"
            name="siteId"
            as="select"
            value={form.siteId}
            onChange={updateField}
            options={sites.map((site) => ({ value: site.id, label: site.name }))}
            required
          />
          <FormField
            label="Asset (optional)"
            name="assetId"
            as="select"
            value={form.assetId}
            onChange={updateField}
            options={[
              { value: "", label: "No asset" },
              ...siteAssets.map((asset) => ({ value: asset.id, label: asset.name })),
            ]}
          />
          <div className="md:col-span-2">
            <FormField
              label="Description"
              name="description"
              as="textarea"
              value={form.description}
              onChange={updateField}
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting || sites.length === 0}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "Creating..." : "Create work order"}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? <LoadingState /> : null}
      {!loading && workOrders.length === 0 ? <EmptyState message="No work orders yet." /> : null}
      {!loading && workOrders.length > 0 ? (
        <div className="grid gap-4">
          {workOrders.map((order) => (
            <RecordLink
              key={order.id}
              to={`/workorders/${order.id}`}
              title={`${order.code} · ${order.title}`}
              subtitle={[order.site?.name, order.asset?.name].filter(Boolean).join(" · ")}
              badge={order.status}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
