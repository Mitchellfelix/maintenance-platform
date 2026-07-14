import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import FormField from "../components/FormField.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader, { EmptyState, RecordLink } from "../components/PageHeader.jsx";
import { getRoleLabel } from "../lib/permissions.js";

const emptyForm = {
  title: "",
  summary: "",
  assetId: "",
  assigneeId: "",
};

export default function GreentaggingPage() {
  const { isAuthenticated, can } = useAuth();
  const [searchParams] = useSearchParams();
  const [assignments, setAssignments] = useState([]);
  const [assets, setAssets] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ ...emptyForm, assetId: searchParams.get("assetId") || "" });
  const [submitting, setSubmitting] = useState(false);
  const [assetFilter, setAssetFilter] = useState(searchParams.get("assetId") || "");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const query = assetFilter ? `?assetId=${encodeURIComponent(assetFilter)}` : "";
      const requests = [api.get(`/api/greentagging${query}`), api.get("/api/assets")];
      if (can("greentagging:write")) {
        requests.push(api.get("/api/users/assignees"));
      }
      const [assignmentRes, assetsRes, assigneesRes] = await Promise.all(requests);
      setAssignments(assignmentRes.data);
      setAssets(assetsRes.data);
      if (assigneesRes) setAssignees(assigneesRes.data);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load greentagging"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [assetFilter, can]);

  const grouped = useMemo(() => {
    const groups = new Map();
    for (const item of assignments) {
      const key = item.assetId;
      const list = groups.get(key) || { asset: item.asset, items: [] };
      list.items.push(item);
      groups.set(key, list);
    }
    return [...groups.values()].sort((a, b) =>
      (a.asset?.name || "").localeCompare(b.asset?.name || ""),
    );
  }, [assignments]);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.post("/api/greentagging", {
        title: form.title.trim(),
        summary: form.summary.trim() || null,
        assetId: form.assetId,
        assigneeId: form.assigneeId || null,
      });
      setForm({ ...emptyForm, assetId: assetFilter || "" });
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to create greentagging assignment"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Greentagging"
        description="Asset greentagging efforts broken into process cases, with directions for how to complete each stage."
      />

      <ErrorBanner message={error} />

      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-3xl border border-slate-600 bg-slate-800/90 p-4 shadow-sm">
        <div className="min-w-[14rem] flex-1">
          <FormField
            label="Filter by asset"
            name="assetFilter"
            as="select"
            value={assetFilter}
            onChange={(event) => setAssetFilter(event.target.value)}
            options={[
              { value: "", label: "All assets" },
              ...assets.map((asset) => ({
                value: asset.id,
                label: `${asset.name}${asset.site?.name ? ` · ${asset.site.name}` : ""}`,
              })),
            ]}
          />
        </div>
      </div>

      {loading ? <LoadingState label="Loading greentagging..." /> : null}

      {!loading && grouped.length === 0 ? (
        <EmptyState message="No greentagging assignments yet. Create one below to start a process on an asset." />
      ) : null}

      {!loading ? (
        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.asset?.id || "unknown"}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">{group.asset?.name || "Unknown asset"}</h3>
                  <p className="text-sm text-slate-400">
                    {group.asset?.site?.name || "Unknown site"}
                    {group.asset?.serialNumber ? ` · ${group.asset.serialNumber}` : ""}
                  </p>
                </div>
                {group.asset?.id ? (
                  <Link to={`/assets/${group.asset.id}`} className="text-sm text-orange-300 hover:underline">
                    Open asset
                  </Link>
                ) : null}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {group.items.map((item) => (
                  <RecordLink
                    key={item.id}
                    to={`/greentagging/${item.id}`}
                    title={item.title}
                    subtitle={`${item.cases?.length || 0} process case${item.cases?.length === 1 ? "" : "s"}${
                      item.assignee ? ` · ${item.assignee.name || item.assignee.email}` : ""
                    }`}
                    badge={item.status}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {isAuthenticated && can("greentagging:write") ? (
        <form
          className="mt-8 space-y-4 rounded-3xl border border-slate-600 bg-slate-800/90 p-6 shadow-sm"
          onSubmit={handleCreate}
        >
          <h3 className="text-lg font-semibold">New greentagging assignment</h3>
          <p className="text-sm text-slate-400">
            Starts with default process cases (Preparation, Inspection, Tag application, Verification). You can
            edit directions and add more cases on the detail page.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Title" name="title" value={form.title} onChange={updateField} required />
            <FormField
              label="Asset"
              name="assetId"
              as="select"
              value={form.assetId}
              onChange={updateField}
              required
              options={[
                { value: "", label: "Select asset" },
                ...assets.map((asset) => ({
                  value: asset.id,
                  label: `${asset.name}${asset.site?.name ? ` · ${asset.site.name}` : ""}`,
                })),
              ]}
            />
            <FormField
              label="Assignee"
              name="assigneeId"
              as="select"
              value={form.assigneeId}
              onChange={updateField}
              options={[
                { value: "", label: "Unassigned" },
                ...assignees.map((person) => ({
                  value: person.id,
                  label: `${person.name || person.email} (${getRoleLabel(person.role)})`,
                })),
              ]}
            />
            <FormField
              label="Summary"
              name="summary"
              value={form.summary}
              onChange={updateField}
              placeholder="Optional overview of this effort"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Create assignment
          </button>
        </form>
      ) : null}
    </div>
  );
}
