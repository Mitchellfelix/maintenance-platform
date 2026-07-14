import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { canEditWorkOrder, getRoleLabel, getWorkOrderFieldAccess } from "../lib/permissions.js";
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
  const { user, isAuthenticated, can } = useAuth();
  const [workOrder, setWorkOrder] = useState(null);
  const [sites, setSites] = useState([]);
  const [assets, setAssets] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "OPEN",
    priority: "MEDIUM",
    siteId: "",
    assetId: "",
    assigneeId: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fieldAccess = getWorkOrderFieldAccess(user?.role);
  const editable = workOrder && user && canEditWorkOrder(user, workOrder);

  async function loadWorkOrder() {
    setLoading(true);
    setError("");
    try {
      const requests = [
        api.get(`/api/workorders/${id}`),
        api.get("/api/sites"),
        api.get("/api/assets"),
      ];
      if (can("workorders:assign")) {
        requests.push(api.get("/api/users/assignees"));
      }

      const [orderResponse, sitesResponse, assetsResponse, assigneesResponse] = await Promise.all(requests);
      setWorkOrder(orderResponse.data);
      setSites(sitesResponse.data);
      setAssets(assetsResponse.data);
      if (assigneesResponse) {
        setAssignees(assigneesResponse.data);
      }
      setForm({
        title: orderResponse.data.title,
        description: orderResponse.data.description || "",
        status: orderResponse.data.status,
        priority: orderResponse.data.priority,
        siteId: orderResponse.data.siteId,
        assetId: orderResponse.data.assetId || "",
        assigneeId: orderResponse.data.assigneeId || "",
      });
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load work order"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWorkOrder();
  }, [id, user?.role]);

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

  function buildPayload() {
    const payload = {};
    if (fieldAccess.title) payload.title = form.title;
    if (fieldAccess.description) payload.description = form.description || null;
    if (fieldAccess.status) payload.status = form.status;
    if (fieldAccess.priority) payload.priority = form.priority;
    if (fieldAccess.siteId) payload.siteId = form.siteId;
    if (fieldAccess.assetId) payload.assetId = form.assetId || null;
    if (fieldAccess.assigneeId) payload.assigneeId = form.assigneeId || null;
    return payload;
  }

  async function handleSave(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await api.patch(`/api/workorders/${id}`, buildPayload());
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
            <Link to="/workorders" className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium">
              Back to work orders
            </Link>
          </div>
        }
      />

      <ErrorBanner message={error} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-600 bg-slate-800/90 p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Timeline</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Requester</dt>
              <dd className="font-medium">{workOrder.requester?.name || workOrder.requester?.email || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Assignee</dt>
              <dd className="font-medium">{workOrder.assignee?.name || workOrder.assignee?.email || "Unassigned"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Due</dt>
              <dd className="font-medium">{formatDate(workOrder.dueAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Started</dt>
              <dd className="font-medium">{formatDate(workOrder.startedAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Completed</dt>
              <dd className="font-medium">{formatDate(workOrder.completedAt)}</dd>
            </div>
          </dl>
          {workOrder.description ? <p className="mt-4 text-sm text-slate-300">{workOrder.description}</p> : null}
        </section>

        {isAuthenticated && editable ? (
          <form className="space-y-4 rounded-3xl border border-slate-600 bg-slate-800/90 p-6 shadow-sm" onSubmit={handleSave}>
            <h3 className="text-lg font-semibold">Edit work order</h3>
            {fieldAccess.title ? (
              <FormField label="Title" name="title" value={form.title} onChange={updateField} required />
            ) : null}
            {fieldAccess.status ? (
              <FormField
                label="Status"
                name="status"
                as="select"
                value={form.status}
                onChange={updateField}
                options={statusOptions}
              />
            ) : null}
            {fieldAccess.priority ? (
              <FormField
                label="Priority"
                name="priority"
                as="select"
                value={form.priority}
                onChange={updateField}
                options={priorityOptions}
              />
            ) : null}
            {fieldAccess.siteId ? (
              <FormField
                label="Site"
                name="siteId"
                as="select"
                value={form.siteId}
                onChange={updateField}
                options={sites.map((site) => ({ value: site.id, label: site.name }))}
              />
            ) : null}
            {fieldAccess.assetId ? (
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
            ) : null}
            {fieldAccess.assigneeId ? (
              <FormField
                label="Assignee"
                name="assigneeId"
                as="select"
                value={form.assigneeId}
                onChange={updateField}
                options={[
                  { value: "", label: "Unassigned" },
                  ...assignees.map((assignee) => ({
                    value: assignee.id,
                    label: `${assignee.name || assignee.email} (${getRoleLabel(assignee.role)})`,
                  })),
                ]}
              />
            ) : null}
            {fieldAccess.description ? (
              <FormField
                label="Description"
                name="description"
                as="textarea"
                value={form.description}
                onChange={updateField}
              />
            ) : null}
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Save changes
              </button>
              {can("workorders:delete") ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleDelete}
                  className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700"
                >
                  Delete work order
                </button>
              ) : null}
            </div>
          </form>
        ) : (
          <section className="rounded-3xl border border-slate-600 bg-slate-800/90 p-6 shadow-sm">
            <p className="text-sm text-slate-400">
              {!isAuthenticated
                ? "Sign in to edit this work order."
                : "You do not have permission to edit this work order."}
            </p>
            {!isAuthenticated ? (
              <Link to="/login" className="mt-4 inline-flex rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white">
                Sign in
              </Link>
            ) : null}
          </section>
        )}
      </div>
    </div>
  );
}
