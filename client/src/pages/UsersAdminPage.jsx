import { useEffect, useState } from "react";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { ROLES, getRoleLabel } from "../lib/permissions.js";

export default function UsersAdminPage() {
  const { can } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/api/users");
      setUsers(response.data);
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

  if (!can("users:read")) {
    return <ErrorBanner message="You do not have access to user management." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="User access"
        description="Assign Admin, Operator, Technician, or Requester roles."
      />
      <ErrorBanner message={error} />
      {loading ? <LoadingState label="Loading users..." /> : null}
      {!loading ? (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{user.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-xl border border-slate-200 px-3 py-2"
                      value={user.role}
                      disabled={savingId === user.id}
                      onChange={(event) => handleRoleChange(user.id, event.target.value)}
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {getRoleLabel(role)}
                        </option>
                      ))}
                    </select>
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
