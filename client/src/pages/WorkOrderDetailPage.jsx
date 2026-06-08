import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import FormField from "../components/FormField.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { formatDate } from "../utils/labels.js";

const statusOptions = [
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "ON_HOLD", label: "On hold" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const priorityOptions = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

export default function WorkOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [workOrder, setWorkOrder] = useState(null);
  const [sites, setSites] = useState([]);
  const [assets, setAssets] = useState([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "OPEN",
    priority: "MEDIUM",
    siteId: "",
    assetId: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadWorkOrder() {
    setLoading(true);
    setError("");
    try {
      const [orderResponse, sitesResponse, assetsResponse] = await Promise.all([
        api.get(`/api/workorders/${id}`),
        api.get("/api/sites"),
        api.get("/api/assets"),
      ]);
      setWorkOrder(orderResponse.data);
      setSites(sitesResponse.data);
      setAssets(assetsResponse.data);
      setForm({
        title: orderResponse.data.title,
        description: orderResponse.data.description || "",
        status: orderResponse.data.status,
        priority: orderResponse.data.priority,
        siteId: orderResponse.data.siteId,
        assetId: orderResponse.data.assetId || "",
      });
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load work order"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWorkOrder();
  }, [id]);

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

  async function handleSave(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await api.patch(`/api/workorders/${id}`, {
        ...form,
        description: form.description || null,
        assetId: form.assetId || null,
      });
      setWorkOrder(response.data);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update work order"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this work order?")) return;
    setSubmitting(true);
    setError("");
    try {
      await api.delete(`/api/workorders/${id}`);
      navigate("/workorders");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to delete work order"));
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState />;
  if (!workOrder) return <ErrorBanner message={error || "Work order not found"} />;

  return (
    <div>
      <PageHeader
        title={workOrder.title}
        description={`${workOrder.code} · ${workOrder.site?.name || "Unknown site"}`}
        action={
          <div className="flex items-center gap-3">
            <StatusBadge value={workOrder.status} />
            <StatusBadge value={workOrder.priority} />
            <Link to="/workorders" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium">
              Back to work orders
            </Link>
          </div>
        }
      />

      <ErrorBanner message={error} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Timeline</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Requester</dt>
              <dd className="font-medium">{workOrder.requester?.name || workOrder.requester?.email || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Assignee</dt>
              <dd className="font-medium">{workOrder.assignee?.name || workOrder.assignee?.email || "Unassigned"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Due</dt>
              <dd className="font-medium">{formatDate(workOrder.dueAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Started</dt>
              <dd className="font-medium">{formatDate(workOrder.startedAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Completed</dt>
              <dd className="font-medium">{formatDate(workOrder.completedAt)}</dd>
            </div>
          </dl>
          {workOrder.description ? <p className="mt-4 text-sm text-slate-600">{workOrder.description}</p> : null}
        </section>

        {isAuthenticated ? (
          <form className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" onSubmit={handleSave}>
            <h3 className="text-lg font-semibold">Edit work order</h3>
            <FormField label="Title" name="title" value={form.title} onChange={updateField} required />
            <FormField
              label="Status"
              name="status"
              as="select"
              value={form.status}
              onChange={updateField}
              options={statusOptions}
            />
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
            />
            <FormField
              label="Asset"
              name="assetId"
              as="select"
              value={form.assetId}
              onChange={updateField}
              options={[
                { value: "", label: "No asset" },
                ...siteAssets.map((asset) => ({ value: asset.id, label: asset.name })),
              ]}
            />
            <FormField
              label="Description"
              name="description"
              as="textarea"
              value={form.description}
              onChange={updateField}
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Save changes
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDelete}
                className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700"
              >
                Delete work order
              </button>
            </div>
          </form>
        ) : (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Sign in to edit or delete this work order.</p>
            <Link to="/login" className="mt-4 inline-flex rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white">
              Sign in
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
