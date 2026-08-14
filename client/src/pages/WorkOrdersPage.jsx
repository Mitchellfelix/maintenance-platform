import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { getRoleLabel } from "../lib/permissions.js";
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
  assigneeId: "",
  priority: "MEDIUM",
};

export default function WorkOrdersPage() {
  const { isAuthenticated, can } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const createFormRef = useRef(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [sites, setSites] = useState([]);
  const [assets, setAssets] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [createdNotice, setCreatedNotice] = useState("");
  const canAssign = can("workorders:assign");
  const canCreate = isAuthenticated && can("workorders:create");

  const prefills = useMemo(
    () => ({
      siteId: searchParams.get("siteId") || "",
      assetId: searchParams.get("assetId") || "",
      title: searchParams.get("title") || "",
    }),
    [searchParams],
  );

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const requests = [api.get("/api/workorders"), api.get("/api/sites"), api.get("/api/assets")];
      if (canAssign) {
        requests.push(api.get("/api/users/assignees"));
      }
      const [ordersResponse, sitesResponse, assetsResponse, assigneesResponse] = await Promise.all(requests);
      setWorkOrders(ordersResponse.data);
      setSites(sitesResponse.data);
      setAssets(assetsResponse.data);
      if (assigneesResponse) {
        setAssignees(assigneesResponse.data);
      }

      setForm((current) => {
        const next = { ...current };
        const siteFromQuery = prefills.siteId;
        const assetFromQuery = prefills.assetId;
        const assetMatch = assetsResponse.data.find((asset) => asset.id === assetFromQuery);

        if (assetMatch) {
          next.siteId = assetMatch.siteId;
          next.assetId = assetMatch.id;
        } else if (siteFromQuery && sitesResponse.data.some((site) => site.id === siteFromQuery)) {
          next.siteId = siteFromQuery;
          if (current.assetId) {
            const stillValid = assetsResponse.data.some(
              (asset) => asset.id === current.assetId && asset.siteId === siteFromQuery,
            );
            if (!stillValid) next.assetId = "";
          }
        }
        // Do not default to sites[0] — that made create forms look stuck on Pittsburgh.

        if (prefills.title && !current.title) {
          next.title = prefills.title;
        }
        return next;
      });
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load work orders"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [canAssign, prefills.siteId, prefills.assetId, prefills.title]);

  useEffect(() => {
    if (!canCreate) return;
    if (!prefills.siteId && !prefills.assetId) return;
    createFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [canCreate, prefills.siteId, prefills.assetId, loading]);

  const siteAssets = assets.filter((asset) => asset.siteId === form.siteId);
  const selectedSite = sites.find((site) => site.id === form.siteId);
  const selectedAsset = assets.find((asset) => asset.id === form.assetId);

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
    setCreatedNotice("");
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        siteId: form.siteId,
        priority: form.priority,
        assetId: form.assetId || undefined,
      };
      if (canAssign && form.assigneeId) {
        payload.assigneeId = form.assigneeId;
      }
      const response = await api.post("/api/workorders", payload);
      const created = response.data;
      setSearchParams({});
      if (created?.id) {
        navigate(`/workorders/${created.id}`);
        return;
      }
      setForm((current) => ({ ...emptyForm, siteId: "" }));
      setCreatedNotice(
        created?.code
          ? `Created ${created.code}${created.asset?.name ? ` for ${created.asset.name}` : ""}.`
          : "Work order created.",
      );
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
        description="Create a job, attach the asset, and assign someone — all from this page."
        action={
          !isAuthenticated ? (
            <Link to="/login" className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white">
              Sign in to create
            </Link>
          ) : !can("workorders:create") ? (
            <span className="text-sm text-slate-400">You do not have permission to create work orders</span>
          ) : (
            <button
              type="button"
              onClick={() => createFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
            >
              New work order
            </button>
          )
        }
      />

      <ErrorBanner message={error} />
      {createdNotice ? (
        <div className="mb-4 rounded-xl border border-emerald-700/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100">
          {createdNotice}
        </div>
      ) : null}

      {canCreate ? (
        <form
          ref={createFormRef}
          id="create-work-order"
          className="mb-6 grid gap-4 rounded-3xl border border-orange-500/30 bg-slate-800/90 p-6 shadow-sm md:grid-cols-2"
          onSubmit={handleCreate}
        >
          <div className="md:col-span-2">
            <h2 className="text-lg font-semibold text-white">Create work order</h2>
            <p className="mt-1 text-sm text-slate-400">
              Pick the site and asset for this job. You can also start from an asset page — that
              pre-fills these fields.
            </p>
            {selectedAsset || selectedSite ? (
              <p className="mt-2 text-sm text-orange-200">
                {selectedAsset
                  ? `Asset: ${selectedAsset.name}${selectedSite ? ` · Site: ${selectedSite.name}` : ""}`
                  : selectedSite
                    ? `Site: ${selectedSite.name}`
                    : null}
              </p>
            ) : null}
          </div>
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
            options={
              sites.length
                ? [
                    { value: "", label: "Select a site…" },
                    ...sites.map((site) => ({ value: site.id, label: site.name })),
                  ]
                : [{ value: "", label: "No sites yet — create a site first" }]
            }
            required
          />
          <FormField
            label="Asset"
            name="assetId"
            as="select"
            value={form.assetId}
            onChange={updateField}
            options={[
              { value: "", label: siteAssets.length ? "Select asset (recommended)" : "No assets at this site" },
              ...siteAssets.map((asset) => ({ value: asset.id, label: asset.name })),
            ]}
          />
          {canAssign ? (
            <FormField
              label="Assign to"
              name="assigneeId"
              as="select"
              value={form.assigneeId}
              onChange={updateField}
              options={[
                { value: "", label: "Unassigned" },
                ...assignees.map((user) => ({
                  value: user.id,
                  label: `${user.name || user.email} (${getRoleLabel(user.role)})`,
                })),
              ]}
            />
          ) : null}
          <div className="md:col-span-2">
            <FormField
              label="Description"
              name="description"
              as="textarea"
              value={form.description}
              onChange={updateField}
            />
          </div>
          {sites.length === 0 ? (
            <p className="md:col-span-2 text-sm text-amber-200">
              Create a <Link className="underline" to="/sites">site</Link> first, then add{" "}
              <Link className="underline" to="/assets">assets</Link>, then create the work order.
            </p>
          ) : siteAssets.length === 0 ? (
            <p className="md:col-span-2 text-sm text-amber-200">
              This site has no assets yet.{" "}
              <Link className="underline" to="/assets">
                Add an asset
              </Link>{" "}
              (or leave Asset blank and assign one later).
            </p>
          ) : null}
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting || sites.length === 0 || !form.title.trim() || !form.siteId}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "Creating..." : "Create work order"}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? <LoadingState /> : null}
      {!loading && workOrders.length === 0 ? <EmptyState message="No work orders yet. Create one above." /> : null}
      {!loading && workOrders.length > 0 ? (
        <div className="grid gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Open & recent</h2>
          {workOrders.map((order) => (
            <RecordLink
              key={order.id}
              to={`/workorders/${order.id}`}
              title={`${order.code} · ${order.title}`}
              subtitle={[
                order.site?.name,
                order.asset?.name ? `Asset: ${order.asset.name}` : "No asset",
                order.assignee
                  ? `Assigned: ${order.assignee.name || order.assignee.email}`
                  : "Unassigned",
              ]
                .filter(Boolean)
                .join(" · ")}
              badge={order.status}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
