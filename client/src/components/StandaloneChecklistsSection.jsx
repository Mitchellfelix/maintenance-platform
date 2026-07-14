import { useEffect, useState } from "react";
import { api, getErrorMessage } from "../api/client.js";
import FormField from "./FormField.jsx";
import ErrorBanner from "./ErrorBanner.jsx";
import LoadingState from "./LoadingState.jsx";

/**
 * Standalone checklists — not tied to a greentagging job or asset.
 */
export default function StandaloneChecklistsSection({ writable, canDelete }) {
  const [checklists, setChecklists] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [newItemLabel, setNewItemLabel] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const selected = checklists.find((item) => item.id === selectedId) || null;
  const items = selected?.items || [];
  const doneCount = items.filter((item) => item.completedAt).length;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/api/checklists");
      const list = response.data;
      setChecklists(list);
      setSelectedId((current) => {
        if (current && list.some((item) => item.id === current)) return current;
        return list[0]?.id || "";
      });
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load standalone checklists"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setNotes(selected?.notes || "");
    setEditingId("");
    setEditLabel("");
  }, [selected?.id, selected?.notes]);

  function replaceChecklist(next) {
    setChecklists((current) => current.map((item) => (item.id === next.id ? next : item)));
  }

  async function run(action, fallback) {
    setBusy(true);
    setError("");
    try {
      return await action();
    } catch (err) {
      setError(getErrorMessage(err, fallback));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    const created = await run(async () => {
      const response = await api.post("/api/checklists", {
        title: title.trim(),
        notes: notes.trim() || null,
      });
      return response.data;
    }, "Unable to create checklist");
    if (!created) return;
    setTitle("");
    setNotes("");
    setShowCreate(false);
    setChecklists((current) => [created, ...current]);
    setSelectedId(created.id);
  }

  if (loading) return <LoadingState label="Loading standalone checklists..." />;

  return (
    <div className="space-y-6">
      <ErrorBanner message={error} />

      <div className="rounded-3xl border-2 border-orange-500/40 bg-orange-950/20 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-[16rem] flex-1">
            <FormField
              label="Standalone checklists (no job / asset required)"
              name="standaloneSelected"
              as="select"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              options={[
                { value: "", label: checklists.length ? "Select a checklist…" : "No standalone checklists yet" },
                ...checklists.map((item) => {
                  const done = (item.items || []).filter((step) => step.completedAt).length;
                  const total = item.items?.length || 0;
                  return {
                    value: item.id,
                    label: `${item.title}${total ? ` · ${done}/${total}` : ""}`,
                  };
                }),
              ]}
            />
          </div>
          {writable ? (
            <button
              type="button"
              onClick={() => setShowCreate((open) => !open)}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
            >
              {showCreate ? "Close" : "New checklist"}
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          These live on their own. Use them for procedures, audits, or reusable greentagging steps that are not
          tied to one asset arrival.
        </p>
      </div>

      {writable && showCreate ? (
        <form
          className="space-y-4 rounded-3xl border border-slate-600 bg-slate-800/90 p-6"
          onSubmit={handleCreate}
        >
          <h3 className="text-lg font-semibold">Create standalone checklist</h3>
          <FormField
            label="Title"
            name="standaloneTitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. Weekly greentagging audit"
          />
          <FormField
            label="Notes (optional)"
            name="standaloneNotes"
            as="textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Create checklist
          </button>
        </form>
      ) : null}

      {!selected ? (
        <section className="rounded-3xl border border-dashed border-orange-500/40 bg-orange-950/10 p-8 text-center">
          <p className="text-sm text-slate-300">
            {writable
              ? "Create a new standalone checklist, or select one above to edit."
              : "No standalone checklist selected."}
          </p>
        </section>
      ) : (
        <section className="rounded-3xl border-2 border-orange-500/50 bg-gradient-to-b from-orange-950/50 to-slate-800/95 p-6 shadow-lg shadow-orange-950/25">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300/90">
                Standalone checklist
              </p>
              <h3 className="mt-1 text-2xl font-bold text-slate-50">{selected.title}</h3>
              <p className="mt-2 text-sm text-slate-300">Not linked to a job or asset — edit anytime.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {items.length ? (
                <span className="rounded-full bg-orange-500/20 px-3 py-1 text-sm font-semibold text-orange-200">
                  {doneCount}/{items.length} done
                </span>
              ) : null}
              {canDelete ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    if (!window.confirm("Delete this standalone checklist?")) return;
                    const ok = await run(async () => {
                      await api.delete(`/api/checklists/${selected.id}`);
                      return true;
                    }, "Unable to delete checklist");
                    if (!ok) return;
                    setChecklists((current) => current.filter((item) => item.id !== selected.id));
                    setSelectedId("");
                  }}
                  className="rounded-xl border border-rose-300/40 px-3 py-1.5 text-xs font-semibold text-rose-300"
                >
                  Delete checklist
                </button>
              ) : null}
            </div>
          </div>

          {writable ? (
            <form
              className="mb-4 space-y-3"
              onSubmit={async (event) => {
                event.preventDefault();
                const next = await run(async () => {
                  const response = await api.patch(`/api/checklists/${selected.id}`, {
                    title: selected.title,
                    notes: notes.trim() || null,
                  });
                  return response.data;
                }, "Unable to save notes");
                if (next) replaceChecklist(next);
              }}
            >
              <FormField
                label="Rename checklist"
                name="standaloneRename"
                value={selected.title}
                onChange={(e) =>
                  setChecklists((current) =>
                    current.map((item) =>
                      item.id === selected.id ? { ...item, title: e.target.value } : item,
                    ),
                  )
                }
              />
              <FormField
                label="Notes"
                name="standaloneEditNotes"
                as="textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 disabled:opacity-60"
              >
                Save checklist details
              </button>
            </form>
          ) : selected.notes ? (
            <pre className="mb-4 whitespace-pre-wrap rounded-2xl border border-slate-700 bg-slate-900/70 p-4 text-sm text-slate-100">
              {selected.notes}
            </pre>
          ) : null}

          {items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-orange-400/40 px-4 py-8 text-center text-sm text-slate-400">
              No steps yet. Add checklist items below.
            </p>
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
                        onChange={async (event) => {
                          const next = await run(async () => {
                            const response = await api.patch(
                              `/api/checklists/${selected.id}/items/${item.id}`,
                              { completed: event.target.checked },
                            );
                            return response.data;
                          }, "Unable to update item");
                          if (next) replaceChecklist(next);
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        {writable && editingId === item.id ? (
                          <form
                            className="flex flex-wrap gap-2"
                            onSubmit={async (event) => {
                              event.preventDefault();
                              const label = editLabel.trim();
                              if (!label) return;
                              const next = await run(async () => {
                                const response = await api.patch(
                                  `/api/checklists/${selected.id}/items/${item.id}`,
                                  { label },
                                );
                                return response.data;
                              }, "Unable to save item");
                              if (next) {
                                setEditingId("");
                                replaceChecklist(next);
                              }
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
                              className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId("")}
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
                                onClick={() => {
                                  setEditingId(item.id);
                                  setEditLabel(item.label);
                                }}
                                className="text-xs font-medium text-orange-300 hover:underline"
                              >
                                Edit text
                              </button>
                            ) : null}
                          </div>
                        )}

                        <div className="mt-3 rounded-xl border border-dashed border-slate-600 bg-slate-950/40 p-3">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Photos {photos.length ? `(${photos.length})` : ""}
                            </p>
                            {writable ? (
                              <label className="inline-flex cursor-pointer rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white">
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic"
                                  className="hidden"
                                  disabled={busy}
                                  onChange={async (event) => {
                                    const file = event.target.files?.[0];
                                    event.target.value = "";
                                    if (!file) return;
                                    const next = await run(async () => {
                                      const body = new FormData();
                                      body.append("photo", file);
                                      const response = await api.post(
                                        `/api/checklists/${selected.id}/items/${item.id}/photos`,
                                        body,
                                      );
                                      return response.data;
                                    }, "Unable to upload photo");
                                    if (next) replaceChecklist(next);
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
                                  <a href={photo.url} target="_blank" rel="noopener noreferrer">
                                    <img
                                      src={photo.url}
                                      alt={photo.originalName || "Photo"}
                                      className="h-24 w-24 rounded-xl border border-slate-600 object-cover"
                                    />
                                  </a>
                                  {writable ? (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (!window.confirm("Remove this photo?")) return;
                                        const next = await run(async () => {
                                          const response = await api.delete(
                                            `/api/checklists/${selected.id}/items/${item.id}/photos/${photo.id}`,
                                          );
                                          return response.data;
                                        }, "Unable to remove photo");
                                        if (next) replaceChecklist(next);
                                      }}
                                      className="absolute -right-1 -top-1 rounded-full bg-slate-950 px-1.5 text-xs text-rose-300 ring-1 ring-rose-400/40"
                                    >
                                      ×
                                    </button>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500">
                              {writable ? "No photos yet." : "No photos attached."}
                            </p>
                          )}
                        </div>
                      </div>
                      {writable ? (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm("Remove this item?")) return;
                            const next = await run(async () => {
                              const response = await api.delete(
                                `/api/checklists/${selected.id}/items/${item.id}`,
                              );
                              return response.data;
                            }, "Unable to remove item");
                            if (next) replaceChecklist(next);
                          }}
                          className="text-xs text-rose-300 hover:underline"
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
              onSubmit={async (event) => {
                event.preventDefault();
                const label = newItemLabel.trim();
                if (!label) return;
                const next = await run(async () => {
                  const response = await api.post(`/api/checklists/${selected.id}/items`, { label });
                  return response.data;
                }, "Unable to add item");
                if (next) {
                  setNewItemLabel("");
                  replaceChecklist(next);
                }
              }}
            >
              <div className="min-w-[16rem] flex-1">
                <FormField
                  label="Add checklist item"
                  name="newStandaloneItem"
                  value={newItemLabel}
                  onChange={(e) => setNewItemLabel(e.target.value)}
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
      )}
    </div>
  );
}
