import { useEffect, useState } from "react";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import RoleSelect from "../components/RoleSelect.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { REGISTRATION_ROLES, getRoleLabel, isSiteScopedRole } from "../lib/permissions.js";

function buildReviewDraft(request) {
  return {
    requestedRole: request.requestedRole,
    requestedSiteIds: request.requestedSiteIds || [],
  };
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
      setReviewDrafts(
        Object.fromEntries(
          requestsResponse.data
            .filter((entry) => entry.status === "PENDING")
            .map((entry) => [entry.id, buildReviewDraft(entry)]),
        ),
      );

      try {
        const sitesResponse = await api.get("/api/sites");
        setSites(sitesResponse.data);
      } catch (sitesErr) {
        setSites([]);
        setError(
          getErrorMessage(
            sitesErr,
            "Access requests loaded, but sites could not be loaded for assignment.",
          ),
        );
      }
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
    const reviewNote = window.prompt(
      action === "approve" ? "Approval note (optional)" : "Rejection reason (optional)",
    );
    if (reviewNote === null) return;

    const draft = reviewDrafts[requestId];
    setActingId(requestId);
    setError("");
    try {
      const payload = { reviewNote: reviewNote.trim() || undefined };
      if (action === "approve" && draft) {
        payload.requestedRole = draft.requestedRole;
        if (isSiteScopedRole(draft.requestedRole)) {
          payload.requestedSiteIds = draft.requestedSiteIds;
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
        description="Review requests, choose the correct role, and approve or reject access."
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
                            onChange={(event) =>
                              updateReviewDraft(entry.id, {
                                requestedRole: event.target.value,
                                requestedSiteIds:
                                  isSiteScopedRole(event.target.value) ? draft.requestedSiteIds : [],
                              })
                            }
                            roles={REGISTRATION_ROLES}
                            disabled={actingId === entry.id}
                          />
                        ) : (
                          <span className="font-medium">{getRoleLabel(entry.requestedRole)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {isPending && draft && isSiteScopedRole(draft.requestedRole) ? (
                          <div className="flex flex-col gap-2">
                            {sites.length === 0 ? (
                              <span className="text-slate-400">No sites available</span>
                            ) : (
                              sites.map((site) => (
                                <label key={site.id} className="flex items-center gap-2 text-slate-200">
                                  <input
                                    type="checkbox"
                                    checked={draft.requestedSiteIds.includes(site.id)}
                                    disabled={actingId === entry.id}
                                    onChange={() => toggleReviewSite(entry.id, site.id)}
                                  />
                                  {site.name}
                                </label>
                              ))
                            )}
                          </div>
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
                          <div className="flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => handleReview(entry.id, "approve")}
                              disabled={
                                actingId === entry.id ||
                                !draft ||
                                (isSiteScopedRole(draft.requestedRole) &&
                                  (draft.requestedSiteIds?.length ?? 0) === 0)
                              }
                              className="rounded-xl bg-orange-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReview(entry.id, "reject")}
                              disabled={actingId === entry.id}
                              className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 disabled:opacity-60"
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
