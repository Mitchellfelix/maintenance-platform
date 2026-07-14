import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import FormField from "../components/FormField.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { getRoleLabel } from "../lib/permissions.js";
import { statusLabel } from "../utils/labels.js";

function greenTagStatusLabel(status) {
  if (status === "OPEN") return "awaiting";
  if (status === "COMPLETED") return "complete";
  return statusLabel(status);
}

const emptyForm = {
  title: "",
  summary: "",
  instructions: "",
  assetId: "",
  assigneeId: "",
};

const BOARD_COLUMNS = [
  {
    id: "awaiting",
    title: "Awaiting from field",
    description: "Arrived and ready to greentag",
    statuses: ["OPEN", "ON_HOLD"],
    accent: "border-sky-500/40 bg-sky-950/30",
    header: "text-sky-300",
  },
  {
    id: "in_progress",
    title: "In progress",
    description: "Currently being greentagged",
    statuses: ["IN_PROGRESS"],
    accent: "border-amber-500/40 bg-amber-950/20",
    header: "text-amber-300",
  },
  {
    id: "complete",
    title: "Complete",
    description: "Greentagging finished",
    statuses: ["COMPLETED"],
    accent: "border-orange-500/40 bg-orange-950/20",
    header: "text-orange-300",
  },
];

function caseProgress(assignment) {
  const cases = assignment.cases || [];
  if (!cases.length) return { done: 0, total: 0, label: "No cases yet" };
  const done = cases.filter((item) => item.status === "COMPLETED").length;
  return {
    done,
    total: cases.length,
    label: `${done}/${cases.length} cases done`,
  };
}

function checklistProgress(assignment) {
  const items = assignment.checklistItems || [];
  if (!items.length) return null;
  const done = items.filter((item) => item.completedAt).length;
  return `${done}/${items.length} checklist`;
}

function AssignmentCard({ item, writable, busyId, onMove }) {
  const progress = caseProgress(item);
  const checklist = checklistProgress(item);
  const isBusy = busyId === item.id;

  return (
    <article className="rounded-2xl border border-slate-600/80 bg-slate-900/70 p-4 shadow-sm transition hover:border-slate-500">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/greentagging/${item.id}`}
            className="block truncate font-semibold text-slate-100 hover:text-orange-300"
          >
            {item.title}
          </Link>
          <p className="mt-1 text-sm text-slate-400">
            {item.asset?.name || "Unknown asset"}
            {item.asset?.site?.name ? ` · ${item.asset.site.name}` : ""}
          </p>
        </div>
        <StatusBadge value={item.status} label={greenTagStatusLabel(item.status)} />
      </div>

      <p className="mt-3 text-xs text-slate-400">
        {progress.label}
        {checklist ? ` · ${checklist}` : ""}
        {item.assignee ? ` · ${item.assignee.name || item.assignee.email}` : " · Unassigned"}
      </p>

      {item.summary ? (
        <p className="mt-2 line-clamp-2 text-sm text-slate-300">{item.summary}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to={`/greentagging/${item.id}`}
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
        >
          Open
        </Link>
        {writable && item.status !== "IN_PROGRESS" && item.status !== "COMPLETED" ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onMove(item.id, "IN_PROGRESS")}
            className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-200 ring-1 ring-amber-500/40 disabled:opacity-60"
          >
            Start
          </button>
        ) : null}
        {writable && item.status === "IN_PROGRESS" ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onMove(item.id, "COMPLETED")}
            className="rounded-lg bg-orange-500/20 px-3 py-1.5 text-xs font-semibold text-orange-200 ring-1 ring-orange-500/40 disabled:opacity-60"
          >
            Mark complete
          </button>
        ) : null}
        {writable && item.status === "COMPLETED" ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onMove(item.id, "OPEN")}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 disabled:opacity-60"
          >
            Reopen
          </button>
        ) : null}
        {writable && item.status === "ON_HOLD" ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onMove(item.id, "OPEN")}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 disabled:opacity-60"
          >
            Resume queue
          </button>
        ) : null}
      </div>
    </article>
  );
}

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
  const [busyId, setBusyId] = useState("");
  const [assetFilter, setAssetFilter] = useState(searchParams.get("assetId") || "");
  const [showCancelled, setShowCancelled] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const writable = can("greentagging:write");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const query = assetFilter ? `?assetId=${encodeURIComponent(assetFilter)}` : "";
      const requests = [api.get(`/api/greentagging${query}`), api.get("/api/assets")];
      if (writable) {
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
  }, [assetFilter, writable]);

  const counts = useMemo(() => {
    const next = { awaiting: 0, in_progress: 0, complete: 0, cancelled: 0 };
    for (const item of assignments) {
      if (item.status === "OPEN" || item.status === "ON_HOLD") next.awaiting += 1;
      else if (item.status === "IN_PROGRESS") next.in_progress += 1;
      else if (item.status === "COMPLETED") next.complete += 1;
      else if (item.status === "CANCELLED") next.cancelled += 1;
    }
    return next;
  }, [assignments]);

  const columns = useMemo(() => {
    return BOARD_COLUMNS.map((column) => ({
      ...column,
      items: assignments
        .filter((item) => column.statuses.includes(item.status))
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    }));
  }, [assignments]);

  const cancelledItems = useMemo(
    () => assignments.filter((item) => item.status === "CANCELLED"),
    [assignments],
  );

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
        instructions: form.instructions.trim() || null,
        assetId: form.assetId,
        assigneeId: form.assigneeId || null,
        status: "OPEN",
      });
      setForm({ ...emptyForm, assetId: assetFilter || "" });
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to log field arrival"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMove(id, status) {
    setBusyId(id);
    setError("");
    try {
      const response = await api.patch(`/api/greentagging/${id}`, { status });
      setAssignments((current) =>
        current.map((item) => (item.id === id ? { ...item, ...response.data } : item)),
      );
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update status"));
    } finally {
      setBusyId("");
    }
  }

  return (
    <div>
      <PageHeader
        title="Greentagging"
        description="See what arrived from the field, what is being tagged, and what is already complete."
        action={
          isAuthenticated && writable ? (
            <button
              type="button"
              onClick={() => setShowCreate((open) => !open)}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
            >
              {showCreate ? "Close form" : "Log arrival from field"}
            </button>
          ) : null
        }
      />

      <ErrorBanner message={error} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { id: "awaiting", label: "Awaiting from field", value: counts.awaiting, tone: "text-sky-300" },
          { id: "in_progress", label: "In progress", value: counts.in_progress, tone: "text-amber-300" },
          { id: "complete", label: "Complete", value: counts.complete, tone: "text-orange-300" },
        ].map((card) => (
          <div key={card.id} className="rounded-2xl border border-slate-600 bg-slate-800/90 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">{card.label}</p>
            <p className={`mt-2 text-3xl font-bold ${card.tone}`}>{loading ? "…" : card.value}</p>
          </div>
        ))}
      </div>

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
        {counts.cancelled > 0 ? (
          <label className="mb-1 flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={showCancelled}
              onChange={(event) => setShowCancelled(event.target.checked)}
              className="rounded border-slate-500"
            />
            Show cancelled ({counts.cancelled})
          </label>
        ) : null}
      </div>

      {isAuthenticated && writable && showCreate ? (
        <form
          className="mb-6 space-y-4 rounded-3xl border border-sky-500/30 bg-slate-800/90 p-6 shadow-sm"
          onSubmit={handleCreate}
        >
          <div>
            <h3 className="text-lg font-semibold">Log arrival from field</h3>
            <p className="mt-1 text-sm text-slate-400">
              Creates an assignment in <span className="text-sky-300">Awaiting from field</span> with the
              standard process cases and directions ready to follow.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="What arrived?"
              name="title"
              value={form.title}
              onChange={updateField}
              required
              placeholder="e.g. Pump skid returned from vessel"
            />
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
              label="Assign to"
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
              label="Notes from field"
              name="summary"
              value={form.summary}
              onChange={updateField}
              placeholder="Optional context for the greentagging team"
            />
            <FormField
              label="Extra notes (optional)"
              name="instructions"
              as="textarea"
              value={form.instructions}
              onChange={updateField}
              placeholder="Optional notes in addition to the checklist"
            />
          </div>
          <p className="text-xs text-slate-400">
            New arrivals get a starter checklist automatically (asset ID, PPE, process stages, documentation,
            notify ops).
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Add to awaiting queue
          </button>
        </form>
      ) : null}

      {loading ? <LoadingState label="Loading greentagging board..." /> : null}

      {!loading ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {columns.map((column) => (
            <section
              key={column.id}
              className={`rounded-3xl border p-4 shadow-sm ${column.accent}`}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className={`text-base font-semibold ${column.header}`}>{column.title}</h3>
                  <p className="mt-1 text-xs text-slate-400">{column.description}</p>
                </div>
                <span className="rounded-full bg-slate-950/50 px-2.5 py-1 text-xs font-semibold text-slate-200">
                  {column.items.length}
                </span>
              </div>

              {column.items.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-600/80 px-3 py-8 text-center text-sm text-slate-400">
                  Nothing here right now.
                </p>
              ) : (
                <div className="space-y-3">
                  {column.items.map((item) => (
                    <AssignmentCard
                      key={item.id}
                      item={item}
                      writable={writable}
                      busyId={busyId}
                      onMove={handleMove}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      ) : null}

      {!loading && showCancelled && cancelledItems.length > 0 ? (
        <section className="mt-6 rounded-3xl border border-slate-600 bg-slate-800/90 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Cancelled</h3>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {cancelledItems.map((item) => (
              <AssignmentCard
                key={item.id}
                item={item}
                writable={writable}
                busyId={busyId}
                onMove={handleMove}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
