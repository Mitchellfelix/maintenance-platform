import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import FormField from "./FormField.jsx";
import StatusBadge from "./StatusBadge.jsx";
import { caseSelectOptions } from "../lib/greenTagCases.js";

/**
 * Process Case A–W picker for the greentagging board (selected job).
 */
export default function GreentagCasesPanel({ assignment, writable, onAssignmentChange, onError }) {
  const [busy, setBusy] = useState(false);
  const [activeCaseId, setActiveCaseId] = useState("");

  const cases = assignment?.cases || [];
  const assignmentId = assignment?.id;
  const activeCase = cases.find((item) => item.id === activeCaseId) || cases[0] || null;

  useEffect(() => {
    setActiveCaseId(cases[0]?.id || "");
  }, [assignmentId]);

  useEffect(() => {
    if (!assignmentId || !writable) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await api.post(`/api/greentagging/${assignmentId}/cases/ensure-standard`);
        if (cancelled) return;
        onAssignmentChange?.(response.data);
        if (!activeCaseId && response.data.cases?.[0]) {
          setActiveCaseId(response.data.cases[0].id);
        }
      } catch {
        // Keep existing cases; detail page can still add Case A–W.
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally only when job selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, writable]);

  async function updateStatus(status) {
    if (!assignmentId || !activeCase) return;
    setBusy(true);
    onError?.("");
    try {
      const response = await api.patch(`/api/greentagging/${assignmentId}/cases/${activeCase.id}`, {
        status,
      });
      onAssignmentChange?.(response.data);
    } catch (err) {
      onError?.(getErrorMessage(err, "Unable to update case status"));
    } finally {
      setBusy(false);
    }
  }

  if (!assignment) {
    return null;
  }

  return (
    <section className="mt-6 rounded-3xl border border-slate-600 bg-slate-800/90 p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/90">Process cases</p>
          <h3 className="mt-1 text-xl font-bold text-slate-50">Case A, B, C, D, or W</h3>
          <p className="mt-1 text-sm text-slate-400">
            Pick a case from the dropdown to view its directions.
          </p>
        </div>
        <Link
          to={`/greentagging/${assignment.id}`}
          className="text-sm font-semibold text-orange-300 hover:text-orange-200"
        >
          Edit cases →
        </Link>
      </div>

      {cases.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-600 px-4 py-6 text-center text-sm text-slate-400">
          No process cases yet.
          {writable ? " Standard Case A–W will appear after the job syncs." : null}
        </p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <FormField
              label="Select case"
              name="boardCaseSelect"
              as="select"
              value={activeCase?.id || ""}
              onChange={(event) => setActiveCaseId(event.target.value)}
              options={caseSelectOptions(cases)}
            />
            {writable && activeCase ? (
              <div className="flex flex-wrap gap-2">
                {activeCase.status !== "COMPLETED" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => updateStatus("COMPLETED")}
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Mark {activeCase.title} complete
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => updateStatus("IN_PROGRESS")}
                    className="rounded-xl border border-slate-500 px-3 py-2 text-sm font-semibold text-slate-200 disabled:opacity-60"
                  >
                    Reopen {activeCase.title}
                  </button>
                )}
              </div>
            ) : null}
          </div>

          {activeCase ? (
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-lg font-semibold text-slate-100">{activeCase.title}</h4>
                <StatusBadge value={activeCase.status} />
              </div>
              {activeCase.directions ? (
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-700 bg-slate-900/70 p-4 text-sm leading-relaxed text-slate-100">
                  {activeCase.directions}
                </pre>
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-600 p-4 text-sm text-slate-400">
                  No directions for this case yet. Open the job to edit them.
                </p>
              )}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
