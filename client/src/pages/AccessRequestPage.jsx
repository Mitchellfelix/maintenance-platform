import { useEffect, useState } from "react";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import RoleSelect from "../components/RoleSelect.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { getRoleLabel, getSelectableElevationRoles, getDefaultElevationRole, isSiteScopedRole, ELEVATION_ROLES } from "../lib/permissions.js";

export default function AccessRequestPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState("");
  const selectableRoles = getSelectableElevationRoles(user?.role);
  const defaultRole = getDefaultElevationRole(user?.role);
  const [form, setForm] = useState({
    requestedRole: defaultRole,
    requestedSiteIds: [],
    reason: "",
  });

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [requestsResponse, sitesResponse] = await Promise.all([
        api.get("/api/access-requests/mine"),
        api.get("/api/sites"),
      ]);
      setRequests(requestsResponse.data);
      setSites(sitesResponse.data);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load access requests"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectableRoles.includes(form.requestedRole)) {
      setForm((current) => ({
        ...current,
        requestedRole: defaultRole,
        requestedSiteIds: [],
      }));
    }
  }, [defaultRole, form.requestedRole, selectableRoles]);

  const hasPending = requests.some((entry) => entry.status === "PENDING");

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "requestedRole" && !isSiteScopedRole(value) ? { requestedSiteIds: [] } : {}),
    }));
  }

  function toggleSite(siteId) {
    setForm((current) => ({
      ...current,
      requestedSiteIds: current.requestedSiteIds.includes(siteId)
        ? current.requestedSiteIds.filter((id) => id !== siteId)
        : [...current.requestedSiteIds, siteId],
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        requestedRole: form.requestedRole,
        reason: form.reason || undefined,
      };
      if (isSiteScopedRole(form.requestedRole)) {
        payload.requestedSiteIds = form.requestedSiteIds;
      }

      await api.post("/api/access-requests", payload);
      setForm({ requestedRole: defaultRole, requestedSiteIds: [], reason: "" });
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to submit access request"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(requestId) {
    setCancellingId(requestId);
    setError("");
    try {
      await api.patch(`/api/access-requests/${requestId}/cancel`);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to cancel request"));
    } finally {
      setCancellingId("");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Request access"
        description={`Submit a request for elevated access. Your current role is ${getRoleLabel(user?.role)}.`}
      />
      <ErrorBanner message={error} />

      {!hasPending ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-3xl border border-slate-300 bg-slate-200 p-6 shadow-sm"
        >
          <RoleSelect
            label="Requested role"
            name="requestedRole"
            value={form.requestedRole}
            onChange={updateField}
            roles={selectableRoles.length > 0 ? selectableRoles : ELEVATION_ROLES}
            required
          />

          {isSiteScopedRole(form.requestedRole) ? (
            <div>
              <p className="text-sm font-medium text-slate-700">Sites</p>
              <div className="mt-2 space-y-2">
                {sites.length === 0 ? (
                  <p className="text-sm text-slate-500">No sites available yet.</p>
                ) : (
                  sites.map((site) => (
                    <label key={site.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.requestedSiteIds.includes(site.id)}
                        onChange={() => toggleSite(site.id)}
                      />
                      {site.name}
                    </label>
                  ))
                )}
              </div>
            </div>
          ) : null}

          <label className="block text-sm font-medium text-slate-700">
            Reason
            <textarea
              name="reason"
              value={form.reason}
              onChange={updateField}
              rows={4}
              placeholder="Explain why you need this access"
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>

          <button
            type="submit"
            disabled={submitting || (isSiteScopedRole(form.requestedRole) && form.requestedSiteIds.length === 0)}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {submitting ? "Submitting..." : "Submit request"}
          </button>
        </form>
      ) : (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          You already have a pending request. Cancel it below to submit a new one.
        </div>
      )}

      {loading ? <LoadingState label="Loading your requests..." /> : null}

      {!loading ? (
        <div className="overflow-hidden rounded-3xl border border-slate-300 bg-slate-200 shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-300/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Review</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No access requests yet.
                  </td>
                </tr>
              ) : (
                requests.map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium">{getRoleLabel(entry.requestedRole)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge value={entry.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{entry.reason || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {entry.reviewNote || "—"}
                      {entry.reviewer ? (
                        <span className="mt-1 block text-xs text-slate-400">
                          by {entry.reviewer.name || entry.reviewer.email}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {entry.status === "PENDING" ? (
                        <button
                          type="button"
                          onClick={() => handleCancel(entry.id)}
                          disabled={cancellingId === entry.id}
                          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                        >
                          Cancel
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
