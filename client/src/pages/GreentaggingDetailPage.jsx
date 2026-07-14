import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import FormField from "../components/FormField.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { getRoleLabel } from "../lib/permissions.js";
import { formatDate } from "../utils/labels.js";

const statusOptions = [
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "ON_HOLD", label: "On hold" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function GreentaggingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [assignment, setAssignment] = useState(null);
  const [assignees, setAssignees] = useState([]);
  const [assets, setAssets] = useState([]);
  const [activeCaseId, setActiveCaseId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [assignmentForm, setAssignmentForm] = useState({
    title: "",
    summary: "",
    status: "OPEN",
    assetId: "",
    assigneeId: "",
  });
  const [caseForm, setCaseForm] = useState({
    title: "",
    directions: "",
    status: "OPEN",
  });
  const [newCaseForm, setNewCaseForm] = useState({
    title: "",
    directions: "",
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const requests = [api.get(`/api/greentagging/${id}`), api.get("/api/assets")];
      if (can("greentagging:write")) {
        requests.push(api.get("/api/users/assignees"));
      }
      const [assignmentRes, assetsRes, assigneesRes] = await Promise.all(requests);
      const data = assignmentRes.data;
      setAssignment(data);
      setAssets(assetsRes.data);
      if (assigneesRes) setAssignees(assigneesRes.data);
      setAssignmentForm({
        title: data.title,
        summary: data.summary || "",
        status: data.status,
        assetId: data.assetId,
        assigneeId: data.assigneeId || "",
      });
      const firstCase = data.cases?.[0];
      const nextActive =
        data.cases?.some((item) => item.id === activeCaseId) ? activeCaseId : firstCase?.id || null;
      setActiveCaseId(nextActive);
      const active = data.cases?.find((item) => item.id === nextActive) || firstCase;
      if (active) {
        setCaseForm({
          title: active.title,
          directions: active.directions || "",
          status: active.status,
        });
      }
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load greentagging assignment"));
      setAssignment(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  function selectCase(caseId) {
    if (!assignment) return;
    const selected = assignment.cases.find((item) => item.id === caseId);
    if (!selected) return;
    setActiveCaseId(caseId);
    setCaseForm({
      title: selected.title,
      directions: selected.directions || "",
      status: selected.status,
    });
  }

  async function handleSaveAssignment(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await api.patch(`/api/greentagging/${id}`, {
        title: assignmentForm.title.trim(),
        summary: assignmentForm.summary.trim() || null,
        status: assignmentForm.status,
        assetId: assignmentForm.assetId,
        assigneeId: assignmentForm.assigneeId || null,
      });
      setAssignment(response.data);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update assignment"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveCase(event) {
    event.preventDefault();
    if (!activeCaseId) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await api.patch(`/api/greentagging/${id}/cases/${activeCaseId}`, {
        title: caseForm.title.trim(),
        directions: caseForm.directions.trim() || null,
        status: caseForm.status,
      });
      setAssignment(response.data);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update process case"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddCase(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await api.post(`/api/greentagging/${id}/cases`, {
        title: newCaseForm.title.trim(),
        directions: newCaseForm.directions.trim() || null,
      });
      setAssignment(response.data);
      const newest = response.data.cases[response.data.cases.length - 1];
      setNewCaseForm({ title: "", directions: "" });
      if (newest) {
        setActiveCaseId(newest.id);
        setCaseForm({
          title: newest.title,
          directions: newest.directions || "",
          status: newest.status,
        });
      }
    } catch (err) {
      setError(getErrorMessage(err, "Unable to add process case"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteCase() {
    if (!activeCaseId || !window.confirm("Delete this process case?")) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await api.delete(`/api/greentagging/${id}/cases/${activeCaseId}`);
      setAssignment(response.data);
      const next = response.data.cases?.[0];
      setActiveCaseId(next?.id || null);
      if (next) {
        setCaseForm({
          title: next.title,
          directions: next.directions || "",
          status: next.status,
        });
      } else {
        setCaseForm({ title: "", directions: "", status: "OPEN" });
      }
    } catch (err) {
      setError(getErrorMessage(err, "Unable to delete process case"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteAssignment() {
    if (!window.confirm("Delete this greentagging assignment and all process cases?")) return;
    setSubmitting(true);
    setError("");
    try {
      await api.delete(`/api/greentagging/${id}`);
      navigate("/greentagging");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to delete assignment"));
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState label="Loading greentagging..." />;
  if (!assignment) return <ErrorBanner message={error || "Greentagging assignment not found"} />;

  const activeCase = assignment.cases.find((item) => item.id === activeCaseId);
  const writable = can("greentagging:write");

  return (
    <div>
      <PageHeader
        title={assignment.title}
        description={`Greentagging · ${assignment.asset?.name || "Asset"}${
          assignment.asset?.site?.name ? ` · ${assignment.asset.site.name}` : ""
        }`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge value={assignment.status} />
            <Link
              to="/greentagging"
              className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium"
            >
              Back to greentagging
            </Link>
          </div>
        }
      />

      <ErrorBanner message={error} />

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-600 bg-slate-800/90 p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Asset</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Name</dt>
              <dd className="font-medium">
                {assignment.asset ? (
                  <Link className="text-orange-300 hover:underline" to={`/assets/${assignment.asset.id}`}>
                    {assignment.asset.name}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Site</dt>
              <dd className="font-medium">{assignment.asset?.site?.name || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Serial</dt>
              <dd className="font-medium">{assignment.asset?.serialNumber || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Assignee</dt>
              <dd className="font-medium">
                {assignment.assignee?.name || assignment.assignee?.email || "Unassigned"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Completed</dt>
              <dd className="font-medium">{formatDate(assignment.completedAt)}</dd>
            </div>
          </dl>
          {assignment.summary ? <p className="mt-4 text-sm text-slate-300">{assignment.summary}</p> : null}
        </section>

        {writable ? (
          <form
            className="space-y-4 rounded-3xl border border-slate-600 bg-slate-800/90 p-6 shadow-sm"
            onSubmit={handleSaveAssignment}
          >
            <h3 className="text-lg font-semibold">Assignment details</h3>
            <FormField
              label="Title"
              name="title"
              value={assignmentForm.title}
              onChange={(e) => setAssignmentForm((c) => ({ ...c, title: e.target.value }))}
              required
            />
            <FormField
              label="Asset"
              name="assetId"
              as="select"
              value={assignmentForm.assetId}
              onChange={(e) => setAssignmentForm((c) => ({ ...c, assetId: e.target.value }))}
              options={assets.map((asset) => ({
                value: asset.id,
                label: `${asset.name}${asset.site?.name ? ` · ${asset.site.name}` : ""}`,
              }))}
            />
            <FormField
              label="Status"
              name="status"
              as="select"
              value={assignmentForm.status}
              onChange={(e) => setAssignmentForm((c) => ({ ...c, status: e.target.value }))}
              options={statusOptions}
            />
            <FormField
              label="Assignee"
              name="assigneeId"
              as="select"
              value={assignmentForm.assigneeId}
              onChange={(e) => setAssignmentForm((c) => ({ ...c, assigneeId: e.target.value }))}
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
              as="textarea"
              value={assignmentForm.summary}
              onChange={(e) => setAssignmentForm((c) => ({ ...c, summary: e.target.value }))}
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Save assignment
              </button>
              {can("greentagging:delete") ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleDeleteAssignment}
                  className="rounded-xl border border-rose-300/40 px-4 py-2 text-sm font-semibold text-rose-300"
                >
                  Delete assignment
                </button>
              ) : null}
            </div>
          </form>
        ) : (
          <section className="rounded-3xl border border-slate-600 bg-slate-800/90 p-6 shadow-sm">
            <p className="text-sm text-slate-400">You can view process cases and directions for this assignment.</p>
          </section>
        )}
      </div>

      <section className="rounded-3xl border border-slate-600 bg-slate-800/90 p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Process cases</h3>
          <p className="mt-1 text-sm text-slate-400">
            Each tab is a stage in the greentagging process. Open a case to see or edit the directions.
          </p>
        </div>

        {assignment.cases.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-600 px-4 py-8 text-center text-slate-400">
            No process cases yet. Add the first case below.
          </p>
        ) : (
          <>
            <div
              className="flex flex-wrap gap-2 border-b border-slate-700 pb-3"
              role="tablist"
              aria-label="Greentagging process cases"
            >
              {assignment.cases.map((item) => {
                const active = item.id === activeCaseId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => selectCase(item.id)}
                    className={[
                      "rounded-xl px-3 py-2 text-sm font-medium transition",
                      active
                        ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20"
                        : "border border-slate-600 bg-slate-900/60 text-slate-300 hover:border-slate-500 hover:text-white",
                    ].join(" ")}
                  >
                    <span className="mr-2 inline-flex items-center gap-2">
                      {item.title}
                      <StatusBadge value={item.status} />
                    </span>
                  </button>
                );
              })}
            </div>

            {activeCase ? (
              <div className="mt-5 grid gap-6 lg:grid-cols-2" role="tabpanel">
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="font-semibold text-slate-100">{activeCase.title}</h4>
                    <StatusBadge value={activeCase.status} />
                  </div>
                  {activeCase.directions ? (
                    <pre className="whitespace-pre-wrap rounded-2xl border border-slate-700 bg-slate-900/70 p-4 text-sm leading-relaxed text-slate-100">
                      {activeCase.directions}
                    </pre>
                  ) : (
                    <p className="rounded-2xl border border-dashed border-slate-600 p-4 text-sm text-slate-400">
                      No directions yet for this case.
                    </p>
                  )}
                  {activeCase.completedAt ? (
                    <p className="mt-3 text-xs text-slate-500">Completed {formatDate(activeCase.completedAt)}</p>
                  ) : null}
                </div>

                {writable ? (
                  <form className="space-y-4" onSubmit={handleSaveCase}>
                    <h4 className="font-semibold text-slate-100">Edit case directions</h4>
                    <FormField
                      label="Case title"
                      name="caseTitle"
                      value={caseForm.title}
                      onChange={(e) => setCaseForm((c) => ({ ...c, title: e.target.value }))}
                      required
                    />
                    <FormField
                      label="Status"
                      name="caseStatus"
                      as="select"
                      value={caseForm.status}
                      onChange={(e) => setCaseForm((c) => ({ ...c, status: e.target.value }))}
                      options={statusOptions}
                    />
                    <FormField
                      label="Directions / how to complete"
                      name="caseDirections"
                      as="textarea"
                      value={caseForm.directions}
                      onChange={(e) => setCaseForm((c) => ({ ...c, directions: e.target.value }))}
                    />
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Save case
                      </button>
                      {can("greentagging:delete") ? (
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={handleDeleteCase}
                          className="rounded-xl border border-rose-300/40 px-4 py-2 text-sm font-semibold text-rose-300"
                        >
                          Delete case
                        </button>
                      ) : null}
                    </div>
                  </form>
                ) : null}
              </div>
            ) : null}
          </>
        )}

        {writable ? (
          <form
            className="mt-8 space-y-4 border-t border-slate-700 pt-6"
            onSubmit={handleAddCase}
          >
            <h4 className="font-semibold text-slate-100">Add process case</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label="Case title"
                name="newCaseTitle"
                value={newCaseForm.title}
                onChange={(e) => setNewCaseForm((c) => ({ ...c, title: e.target.value }))}
                required
                placeholder="e.g. Re-tag after maintenance"
              />
              <FormField
                label="Directions"
                name="newCaseDirections"
                as="textarea"
                value={newCaseForm.directions}
                onChange={(e) => setNewCaseForm((c) => ({ ...c, directions: e.target.value }))}
                placeholder="Step-by-step how to complete this case"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl border border-orange-400/40 px-4 py-2 text-sm font-semibold text-orange-300 disabled:opacity-60"
            >
              Add case tab
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
