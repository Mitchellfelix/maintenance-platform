import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import FormField from "../components/FormField.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import GreentagChecklistPanel from "../components/GreentagChecklistPanel.jsx";
import GreentagCasesPanel from "../components/GreentagCasesPanel.jsx";
import StandaloneChecklistsSection from "../components/StandaloneChecklistsSection.jsx";
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

function AssignmentCard({ item, writable, busyId, onMove, selected, onSelect }) {
  const progress = caseProgress(item);
  const checklist = checklistProgress(item);
  const isBusy = busyId === item.id;

  return (
    <article
      className={[
        "rounded-2xl border p-4 shadow-sm transition",
        selected
          ? "border-orange-400 bg-orange-950/30 ring-2 ring-orange-500/40"
          : "border-slate-600/80 bg-slate-900/70 hover:border-slate-500",
      ].join(" ")}
    >
      <button type="button" className="w-full text-left" onClick={() => onSelect(item.id)}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-100">{item.title}</p>
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

        {selected ? (
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-orange-300">
            Checklist open below ↓
          </p>
        ) : (
          <p className="mt-3 text-xs text-slate-500">Click to open checklist</p>
        )}
      </button>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            onSelect(item.id);
            requestAnimationFrame(() => {
              document.getElementById("overall-checklist")?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
          }}
          className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white"
        >
          Open checklist
        </button>
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
  const [selectedId, setSelectedId] = useState("");
  const [boardFilter, setBoardFilter] = useState("all");
  const [mode, setMode] = useState("jobs"); // jobs | standalone

  const writable = can("greentagging:write");
  const canDelete = can("greentagging:delete");

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
      const list = assignmentRes.data;
      setAssignments(list);
      setAssets(assetsRes.data);
      if (assigneesRes) setAssignees(assigneesRes.data);

      setSelectedId((current) => {
        if (current && list.some((item) => item.id === current)) return current;
        return list[0]?.id || "";
      });
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
    const statusSets = {
      all: null,
      active: new Set(["OPEN", "ON_HOLD", "IN_PROGRESS"]),
      complete: new Set(["COMPLETED"]),
    };
    const allowed = statusSets[boardFilter];

    return BOARD_COLUMNS.map((column) => ({
      ...column,
      items: assignments
        .filter((item) => column.statuses.includes(item.status))
        .filter((item) => !allowed || allowed.has(item.status))
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    })).filter((column) => {
      if (boardFilter === "active") return column.id !== "complete";
      if (boardFilter === "complete") return column.id === "complete";
      return true;
    });
  }, [assignments, boardFilter]);

  const sortedAssignments = useMemo(
    () =>
      [...assignments].sort((a, b) => {
        const order = { IN_PROGRESS: 0, OPEN: 1, ON_HOLD: 2, COMPLETED: 3, CANCELLED: 4 };
        const byStatus = (order[a.status] ?? 9) - (order[b.status] ?? 9);
        if (byStatus !== 0) return byStatus;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      }),
    [assignments],
  );

  const cancelledItems = useMemo(
    () => assignments.filter((item) => item.status === "CANCELLED"),
    [assignments],
  );

  const selectedAssignment = useMemo(
    () => assignments.find((item) => item.id === selectedId) || null,
    [assignments, selectedId],
  );

  useEffect(() => {
    if (!selectedAssignment || !writable) return;
    if (selectedAssignment.checklistItems?.length) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await api.post(`/api/greentagging/${selectedAssignment.id}/checklist/seed`);
        if (cancelled) return;
        setAssignments((current) =>
          current.map((item) => (item.id === selectedAssignment.id ? response.data : item)),
        );
      } catch {
        // User can still click Add starter checklist.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedAssignment?.id, selectedAssignment?.checklistItems?.length, writable]);

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
        description="Job-linked checklists for field arrivals, plus standalone checklists that are not tied to any asset or job."
        action={
          isAuthenticated && writable && mode === "jobs" ? (
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

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("jobs")}
          className={[
            "rounded-xl px-4 py-2 text-sm font-semibold transition",
            mode === "jobs"
              ? "bg-orange-500 text-white"
              : "border border-slate-600 bg-slate-900/60 text-slate-300 hover:border-slate-500",
          ].join(" ")}
        >
          Jobs & assets
        </button>
        <button
          type="button"
          onClick={() => setMode("standalone")}
          className={[
            "rounded-xl px-4 py-2 text-sm font-semibold transition",
            mode === "standalone"
              ? "bg-orange-500 text-white"
              : "border border-slate-600 bg-slate-900/60 text-slate-300 hover:border-slate-500",
          ].join(" ")}
        >
          Standalone checklists
        </button>
      </div>

      {mode === "standalone" ? (
        <StandaloneChecklistsSection writable={writable} canDelete={canDelete} />
      ) : (
        <>
      <div className="mb-6 rounded-3xl border-2 border-orange-500/40 bg-orange-950/20 p-4 shadow-sm">
        <FormField
          label="Choose any job to edit (including completed)"
          name="selectedJob"
          as="select"
          value={selectedId}
          onChange={(event) => {
            setSelectedId(event.target.value);
            requestAnimationFrame(() => {
              document.getElementById("overall-checklist")?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
          }}
          options={[
            { value: "", label: assignments.length ? "Select a greentagging job…" : "No jobs yet" },
            ...sortedAssignments.map((item) => ({
              value: item.id,
              label: `${item.title} · ${item.asset?.name || "Asset"} · ${greenTagStatusLabel(item.status)}`,
            })),
          ]}
        />
        <p className="mt-2 text-xs text-slate-400">
          Job checklists are linked to an asset arrival. For checklists with no job/asset, use the Standalone
          checklists tab.
        </p>
      </div>

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
            label="Filter board by asset"
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
        <div className="min-w-[12rem]">
          <FormField
            label="Board view"
            name="boardFilter"
            as="select"
            value={boardFilter}
            onChange={(event) => setBoardFilter(event.target.value)}
            options={[
              { value: "all", label: "All statuses" },
              { value: "active", label: "Active only (awaiting + in progress)" },
              { value: "complete", label: "Complete only" },
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
              Creates an assignment in <span className="text-sky-300">Awaiting from field</span> with
              Case A, B, C, D, and W ready to follow.
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
            New arrivals get a starter checklist plus Case A–W automatically.
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
                      selected={item.id === selectedId}
                      onSelect={setSelectedId}
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
                selected={item.id === selectedId}
                onSelect={setSelectedId}
              />
            ))}
          </div>
        </section>
      ) : null}

      {!loading ? (
        <div className="mt-6 space-y-0">
          <GreentagChecklistPanel
            assignment={selectedAssignment}
            writable={writable}
            onError={setError}
            onAssignmentChange={(next) => {
              setAssignments((current) =>
                current.map((item) => (item.id === next.id ? next : item)),
              );
            }}
          />
          <GreentagCasesPanel
            assignment={selectedAssignment}
            writable={writable}
            onError={setError}
            onAssignmentChange={(next) => {
              setAssignments((current) =>
                current.map((item) => (item.id === next.id ? next : item)),
              );
            }}
          />
        </div>
      ) : null}
        </>
      )}
    </div>
  );
}
