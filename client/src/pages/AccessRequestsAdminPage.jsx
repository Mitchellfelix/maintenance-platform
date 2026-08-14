import { useEffect, useState } from "react";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import RoleSelect from "../components/RoleSelect.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { REGISTRATION_ROLES, getRoleLabel, isSiteScopedRole } from "../lib/permissions.js";

function buildReviewDraft(request, allSites = []) {
  const requestedRole = request.requestedRole;
  let requestedSiteIds = Array.isArray(request.requestedSiteIds) ? [...request.requestedSiteIds] : [];

  // One-click approve: pre-select every org site when the request has none yet.
  if (isSiteScopedRole(requestedRole) && requestedSiteIds.length === 0 && allSites.length > 0) {
    requestedSiteIds = allSites.map((site) => site.id);
  }

  return {
    requestedRole,
    requestedSiteIds,
    reviewNote: "",
  };
}

/** Resolve sites for approval; if none chosen, assign every org site. */
function resolveApprovalSiteIds(draft, allSites) {
  if (!draft || !isSiteScopedRole(draft.requestedRole)) return [];
  if (draft.requestedSiteIds?.length) return draft.requestedSiteIds;
  return allSites.map((site) => site.id);
}

export default function AccessRequestsAdminPage() {
  const { can } = useAuth();
  const [requests, setRequests] = useState([]);
  const [sites, setSites] = useState([]);
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState("");
  const [filter, setFilter] = useState("PENDING");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const query = filter ? `?status=${filter}` : "";
      // Load requests independently — a sites failure must not blank the queue.
      const requestsResponse = await api.get(`/api/access-requests${query}`);
      setRequests(requestsResponse.data);

      let loadedSites = [];
      try {
        // Prefer the full org site list for assignment (not the reviewer's scoped /api/sites).
        const sitesResponse = await api.get("/api/auth/registration-sites");
        loadedSites = Array.isArray(sitesResponse.data) ? sitesResponse.data : [];
      } catch (sitesErr) {
        try {
          const fallback = await api.get("/api/sites");
          loadedSites = Array.isArray(fallback.data) ? fallback.data : [];
        } catch {
          loadedSites = [];
          setError(
            getErrorMessage(
              sitesErr,
              "Access requests loaded, but sites could not be loaded for assignment.",
            ),
          );
        }
      }
      setSites(loadedSites);
      setReviewDrafts(
        Object.fromEntries(
          requestsResponse.data
            .filter((entry) => entry.status === "PENDING")
            .map((entry) => [entry.id, buildReviewDraft(entry, loadedSites)]),
        ),
      );
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load access requests"));
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (can("access-requests:read")) {
      loadData();
    }
  }, [can, filter]);

  function siteNames(siteIds = []) {
    if (!siteIds.length) return "—";
    return siteIds
      .map((siteId) => sites.find((site) => site.id === siteId)?.name || siteId)
      .join(", ");
  }

  function updateReviewDraft(requestId, updates) {
    setReviewDrafts((current) => ({
      ...current,
      [requestId]: { ...current[requestId], ...updates },
    }));
  }

  function toggleReviewSite(requestId, siteId) {
    const draft = reviewDrafts[requestId];
    if (!draft) return;

    const requestedSiteIds = draft.requestedSiteIds.includes(siteId)
      ? draft.requestedSiteIds.filter((id) => id !== siteId)
      : [...draft.requestedSiteIds, siteId];

    updateReviewDraft(requestId, { requestedSiteIds });
  }

  async function handleReview(requestId, action) {
    const draft = reviewDrafts[requestId];
    // Do not use window.prompt — Electron returns null immediately, so Approve/Reject look broken.
    const reviewNote = (draft?.reviewNote || "").trim() || undefined;
    const approvalSiteIds =
      action === "approve" ? resolveApprovalSiteIds(draft, sites) : [];

    if (action === "approve" && draft && isSiteScopedRole(draft.requestedRole) && approvalSiteIds.length === 0) {
      setError("Create a site first, then approve Ops Lead or Operator access.");
      return;
    }

    setActingId(requestId);
    setError("");
    try {
      const payload = { reviewNote };
      if (action === "approve" && draft) {
        payload.requestedRole = draft.requestedRole;
        if (isSiteScopedRole(draft.requestedRole)) {
          payload.requestedSiteIds = approvalSiteIds;
        }
      }

      await api.patch(`/api/access-requests/${requestId}/${action}`, payload);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, `Unable to ${action} request`));
    } finally {
      setActingId("");
    }
  }

  if (!can("access-requests:read")) {
    return <ErrorBanner message="You do not have access to access request review." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Access requests"
        description="Press Approve to activate the account. Sites for Ops Lead / Operator are pre-selected (all sites by default); adjust only if needed."
      />
      <ErrorBanner message={error} />

      <div className="flex gap-2">
        {["PENDING", "APPROVED", "REJECTED", "CANCELLED", ""].map((value) => (
          <button
            key={value || "ALL"}
            type="button"
            onClick={() => setFilter(value)}
            className={[
              "rounded-xl px-3 py-2 text-sm font-medium",
              filter === value ? "bg-orange-500 text-white" : "border border-slate-600 bg-slate-800/90 text-slate-200",
            ].join(" ")}
          >
            {value ? value.replaceAll("_", " ").toLowerCase() : "All"}
          </button>
        ))}
      </div>

      {loading ? <LoadingState label="Loading access requests..." /> : null}

      {!loading ? (
        <div className="overflow-hidden rounded-3xl border border-slate-600 bg-slate-800/90 shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-700/70 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Assign role</th>
                <th className="px-4 py-3">Sites</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No access requests found.
                  </td>
                </tr>
              ) : (
                requests.map((entry) => {
                  const draft = reviewDrafts[entry.id];
                  const isPending = entry.status === "PENDING";

                  return (
                    <tr key={entry.id} className="border-t border-slate-700 align-top">
                      <td className="px-4 py-3 text-slate-300">
                        {new Date(entry.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{entry.requester?.name || "—"}</p>
                        <p className="text-xs text-slate-400">{entry.requester?.email}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          Current: {getRoleLabel(entry.requester?.role)}
                          {entry.requester?.status === "PENDING" ? " · account pending" : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {isPending && draft ? (
                          <RoleSelect
                            name={`approve-role-${entry.id}`}
                            value={draft.requestedRole}
                            onChange={(event) => {
                              const nextRole = event.target.value;
                              let nextSites = [];
                              if (isSiteScopedRole(nextRole)) {
                                nextSites =
                                  draft.requestedSiteIds.length > 0
                                    ? draft.requestedSiteIds
                                    : sites.map((site) => site.id);
                              }
                              updateReviewDraft(entry.id, {
                                requestedRole: nextRole,
                                requestedSiteIds: nextSites,
                              });
                            }}
                            roles={REGISTRATION_ROLES}
                            disabled={actingId === entry.id}
                          />
                        ) : (
                          <span className="font-medium">{getRoleLabel(entry.requestedRole)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {isPending && draft && isSiteScopedRole(draft.requestedRole) ? (
                          draft.requestedSiteIds?.length
                            ? siteNames(draft.requestedSiteIds)
                            : <span className="text-slate-400">All sites on Approve</span>
                        ) : (
                          siteNames(entry.requestedSiteIds)
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{entry.reason || "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge value={entry.status} />
                        {entry.reviewNote ? (
                          <p className="mt-2 text-xs text-slate-400">{entry.reviewNote}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {isPending ? (
                          <div className="flex min-w-[12rem] flex-col gap-2">
                            {draft && isSiteScopedRole(draft.requestedRole) ? (
                              <div className="rounded-xl border border-slate-600 bg-slate-950/50 p-2">
                                <div className="mb-1.5 flex items-center justify-between gap-2">
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                                    Sites (pre-selected)
                                  </p>
                                  {sites.length > 1 ? (
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        className="text-[11px] font-medium text-orange-300 hover:underline"
                                        disabled={actingId === entry.id}
                                        onClick={() =>
                                          updateReviewDraft(entry.id, {
                                            requestedSiteIds: sites.map((site) => site.id),
                                          })
                                        }
                                      >
                                        All
                                      </button>
                                      <button
                                        type="button"
                                        className="text-[11px] font-medium text-slate-400 hover:underline"
                                        disabled={actingId === entry.id}
                                        onClick={() =>
                                          updateReviewDraft(entry.id, { requestedSiteIds: [] })
                                        }
                                      >
                                        Clear
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                                {sites.length === 0 ? (
                                  <p className="text-xs text-amber-300">
                                    No sites yet. Create a site first, or approve as Requester.
                                  </p>
                                ) : (
                                  <div className="flex max-h-36 flex-col gap-1.5 overflow-y-auto">
                                    {sites.map((site) => (
                                      <label
                                        key={site.id}
                                        className="flex items-center gap-2 text-xs text-slate-200"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={draft.requestedSiteIds.includes(site.id)}
                                          disabled={actingId === entry.id}
                                          onChange={() => toggleReviewSite(entry.id, site.id)}
                                        />
                                        {site.name}
                                      </label>
                                    ))}
                                  </div>
                                )}
                                <p className="mt-1.5 text-xs text-slate-400">
                                  Approve assigns the checked sites automatically.
                                </p>
                              </div>
                            ) : null}
                            <input
                              type="text"
                              value={draft?.reviewNote || ""}
                              disabled={actingId === entry.id || !draft}
                              onChange={(event) =>
                                updateReviewDraft(entry.id, { reviewNote: event.target.value })
                              }
                              placeholder="Note (optional)"
                              className="rounded-xl border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleReview(entry.id, "approve")}
                              disabled={actingId === entry.id || !draft}
                              className="rounded-xl bg-orange-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                            >
                              {actingId === entry.id ? "Working…" : "Approve"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReview(entry.id, "reject")}
                              disabled={actingId === entry.id}
                              className="rounded-xl border border-rose-300/60 px-3 py-1.5 text-xs font-medium text-rose-300 disabled:opacity-60"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
