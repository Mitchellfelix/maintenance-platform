import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import FormField from "./FormField.jsx";

/**
 * Overall greentagging checklist with photo attachments.
 * Used on the board (selected assignment) and the detail page.
 */
export default function GreentagChecklistPanel({
  assignment,
  writable,
  onAssignmentChange,
  onError,
  showHeader = true,
}) {
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState(assignment?.instructions || "");
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editLabel, setEditLabel] = useState("");

  useEffect(() => {
    setNotes(assignment?.instructions || "");
    setEditingId("");
    setEditLabel("");
  }, [assignment?.id, assignment?.instructions]);

  const items = assignment?.checklistItems || [];
  const doneCount = items.filter((item) => item.completedAt).length;
  const assignmentId = assignment?.id;

  async function run(action, fallbackError) {
    if (!assignmentId) return;
    setBusy(true);
    onError?.("");
    try {
      const next = await action();
      onAssignmentChange?.(next);
      if (next?.instructions !== undefined) {
        setNotes(next.instructions || "");
      }
    } catch (err) {
      onError?.(getErrorMessage(err, fallbackError));
    } finally {
      setBusy(false);
    }
  }

  if (!assignment) {
    return (
      <section
        id="overall-checklist"
        className="scroll-mt-6 rounded-3xl border-2 border-dashed border-orange-500/40 bg-orange-950/20 p-8 text-center"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300/90">Overall checklist</p>
        <h3 className="mt-2 text-xl font-bold text-slate-50">Select a greentagging job</h3>
        <p className="mt-2 text-sm text-slate-400">
          Click any card on the board above. Its checklist and photo uploads will show here.
        </p>
      </section>
    );
  }

  return (
    <section
      id="overall-checklist"
      className="scroll-mt-6 rounded-3xl border-2 border-orange-500/50 bg-gradient-to-b from-orange-950/50 to-slate-800/95 p-6 shadow-lg shadow-orange-950/25"
    >
      {showHeader ? (
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300/90">
              Overall checklist
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-slate-50">{assignment.title}</h3>
            <p className="mt-2 text-sm text-slate-300">
              {assignment.asset?.name || "Asset"}
              {assignment.asset?.site?.name ? ` · ${assignment.asset.site.name}` : ""}
              {" · "}
              Edit steps, photos, and notes anytime — including completed jobs.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {items.length ? (
              <span className="rounded-full bg-orange-500/20 px-3 py-1 text-sm font-semibold text-orange-200">
                {doneCount}/{items.length} done
              </span>
            ) : null}
            <Link
              to={`/greentagging/${assignment.id}`}
              className="rounded-xl border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200"
            >
              Full details
            </Link>
          </div>
        </div>
      ) : null}

      {writable ? (
        <form
          className="mb-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            run(
              async () => {
                const response = await api.patch(`/api/greentagging/${assignmentId}`, {
                  instructions: notes.trim() || null,
                });
                return response.data;
              },
              "Unable to save notes",
            );
          }}
        >
          <FormField
            label="Notes (optional)"
            name="checklistNotes"
            as="textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Extra guidance that doesn’t fit a checkbox…"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 disabled:opacity-60"
          >
            Save notes
          </button>
        </form>
      ) : assignment.instructions ? (
        <pre className="mb-4 whitespace-pre-wrap rounded-2xl border border-slate-700 bg-slate-900/70 p-4 text-sm leading-relaxed text-slate-100">
          {assignment.instructions}
        </pre>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-orange-400/40 bg-slate-950/40 px-4 py-8 text-center">
          <p className="text-sm text-slate-300">No checklist items yet.</p>
          {writable ? (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const response = await api.post(`/api/greentagging/${assignmentId}/checklist/seed`);
                  return response.data;
                }, "Unable to add starter checklist")
              }
              className="mt-3 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Add starter checklist
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const done = Boolean(item.completedAt);
            const photos = item.photos || [];
            return (
              <li
                key={item.id}
                className={[
                  "rounded-2xl border px-3 py-3",
                  done ? "border-orange-500/30 bg-orange-950/20" : "border-slate-600 bg-slate-950/50",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-500"
                    checked={done}
                    disabled={!writable || busy}
                    onChange={(event) =>
                      run(async () => {
                        const response = await api.patch(
                          `/api/greentagging/${assignmentId}/checklist/${item.id}`,
                          { completed: event.target.checked },
                        );
                        return response.data;
                      }, "Unable to update checklist item")
                    }
                    aria-label={item.label}
                  />
                  <div className="min-w-0 flex-1">
                    {writable && editingId === item.id ? (
                      <form
                        className="flex flex-wrap items-center gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const label = editLabel.trim();
                          if (!label) return;
                          run(async () => {
                            const response = await api.patch(
                              `/api/greentagging/${assignmentId}/checklist/${item.id}`,
                              { label },
                            );
                            setEditingId("");
                            setEditLabel("");
                            return response.data;
                          }, "Unable to save checklist item");
                        }}
                      >
                        <input
                          className="flow-input mt-0 min-w-[12rem] flex-1 text-sm"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          autoFocus
                        />
                        <button
                          type="submit"
                          disabled={busy}
                          className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setEditingId("");
                            setEditLabel("");
                          }}
                          className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p
                          className={
                            done
                              ? "text-sm text-slate-400 line-through"
                              : "text-sm font-medium text-slate-100"
                          }
                        >
                          {item.label}
                        </p>
                        {writable ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setEditingId(item.id);
                              setEditLabel(item.label);
                            }}
                            className="text-xs font-medium text-orange-300 hover:underline disabled:opacity-60"
                          >
                            Edit text
                          </button>
                        ) : null}
                      </div>
                    )}
                    {done && item.completedBy ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Checked by {item.completedBy.name || item.completedBy.email}
                      </p>
                    ) : null}

                    <div className="mt-3 rounded-xl border border-dashed border-slate-600 bg-slate-950/40 p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Photos {photos.length ? `(${photos.length})` : ""}
                        </p>
                        {writable ? (
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-400">
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic"
                              className="hidden"
                              disabled={busy}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                if (!file) return;
                                run(async () => {
                                  const body = new FormData();
                                  body.append("photo", file);
                                  const response = await api.post(
                                    `/api/greentagging/${assignmentId}/checklist/${item.id}/photos`,
                                    body,
                                  );
                                  return response.data;
                                }, "Unable to upload photo");
                              }}
                            />
                            + Add photo
                          </label>
                        ) : null}
                      </div>

                      {photos.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {photos.map((photo) => (
                            <div key={photo.id} className="relative">
                              <a href={photo.url} target="_blank" rel="noopener noreferrer" title="Open full size">
                                <img
                                  src={photo.url}
                                  alt={photo.originalName || "Checklist photo"}
                                  className="h-24 w-24 rounded-xl border border-slate-600 object-cover"
                                />
                              </a>
                              {writable ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => {
                                    if (!window.confirm("Remove this photo?")) return;
                                    run(async () => {
                                      const response = await api.delete(
                                        `/api/greentagging/${assignmentId}/checklist/${item.id}/photos/${photo.id}`,
                                      );
                                      return response.data;
                                    }, "Unable to remove photo");
                                  }}
                                  className="absolute -right-1 -top-1 rounded-full bg-slate-950 px-1.5 text-xs text-rose-300 ring-1 ring-rose-400/40"
                                  aria-label="Remove photo"
                                >
                                  ×
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">
                          {writable
                            ? "No photos yet — tap + Add photo to attach evidence for this step."
                            : "No photos attached to this step."}
                        </p>
                      )}
                    </div>
                  </div>
                  {writable ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm("Remove this checklist item?")) return;
                        run(async () => {
                          const response = await api.delete(
                            `/api/greentagging/${assignmentId}/checklist/${item.id}`,
                          );
                          return response.data;
                        }, "Unable to remove checklist item");
                      }}
                      className="text-xs text-rose-300 hover:underline disabled:opacity-60"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {writable ? (
        <form
          className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-700 pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            const label = newLabel.trim();
            if (!label) return;
            run(async () => {
              const response = await api.post(`/api/greentagging/${assignmentId}/checklist`, { label });
              setNewLabel("");
              return response.data;
            }, "Unable to add checklist item");
          }}
        >
          <div className="min-w-[16rem] flex-1">
            <FormField
              label="Add checklist item"
              name="newChecklistLabel"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Verify lockout completed"
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl border border-orange-400/40 px-4 py-2 text-sm font-semibold text-orange-300 disabled:opacity-60"
          >
            Add item
          </button>
        </form>
      ) : null}
    </section>
  );
}
