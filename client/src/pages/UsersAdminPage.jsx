import { useEffect, useState } from "react";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import RoleSelect from "../components/RoleSelect.jsx";
import { ROLES, isSiteScopedRole } from "../lib/permissions.js";

export default function UsersAdminPage() {
  const { can } = useAuth();
  const [users, setUsers] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const [usersResponse, sitesResponse] = await Promise.all([
        api.get("/api/users"),
        api.get("/api/sites"),
      ]);
      setUsers(usersResponse.data);
      setSites(sitesResponse.data);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load users"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (can("users:read")) {
      loadUsers();
    }
  }, [can]);

  async function handleRoleChange(userId, role) {
    setSavingId(userId);
    setError("");
    try {
      await api.patch(`/api/users/${userId}`, { role });
      await loadUsers();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update role"));
    } finally {
      setSavingId("");
    }
  }

  async function handleSiteAccessChange(userId, siteId, checked) {
    const user = users.find((entry) => entry.id === userId);
    if (!user) return;

    const nextSiteIds = checked
      ? [...(user.siteIds || []), siteId]
      : (user.siteIds || []).filter((id) => id !== siteId);

    setSavingId(userId);
    setError("");
    try {
      await api.put(`/api/users/${userId}/sites`, { siteIds: nextSiteIds });
      setUsers((current) =>
        current.map((entry) => (entry.id === userId ? { ...entry, siteIds: nextSiteIds } : entry)),
      );
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update site access"));
    } finally {
      setSavingId("");
    }
  }

  if (!can("users:read")) {
    return <ErrorBanner message="You do not have access to user management." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="User access"
        description="Assign Admin, Ops Lead, Operator, or Requester roles. Ops Leads and Operators can be scoped to specific sites."
      />
      <ErrorBanner message={error} />
      {loading ? <LoadingState label="Loading users..." /> : null}
      {!loading ? (
        <div className="overflow-hidden rounded-3xl border border-slate-300 bg-slate-200 shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-300/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Site access</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3 font-medium">{user.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                        user.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800",
                      ].join(" ")}
                    >
                      {user.status?.toLowerCase() || "active"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <RoleSelect
                      name={`role-${user.id}`}
                      value={user.role}
                      onChange={(event) => handleRoleChange(user.id, event.target.value)}
                      roles={ROLES}
                      disabled={savingId === user.id}
                      showDescription={false}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {isSiteScopedRole(user.role) ? (
                      <div className="flex flex-col gap-2">
                        {sites.length === 0 ? (
                          <span className="text-slate-500">No sites available</span>
                        ) : (
                          sites.map((site) => (
                            <label key={site.id} className="flex items-center gap-2 text-slate-700">
                              <input
                                type="checkbox"
                                checked={(user.siteIds || []).includes(site.id)}
                                disabled={savingId === user.id}
                                onChange={(event) =>
                                  handleSiteAccessChange(user.id, site.id, event.target.checked)
                                }
                              />
                              {site.name}
                            </label>
                          ))
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
