import { useEffect, useState } from "react";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import FormField from "../components/FormField.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import RoleSelect from "../components/RoleSelect.jsx";
import { ROLES, getRoleLabel, isSiteScopedRole } from "../lib/permissions.js";

const emptyCreateForm = {
  name: "",
  email: "",
  role: "REQUESTER",
  password: "",
  siteIds: [],
  sendCredentials: true,
};

const emptyInviteForm = {
  name: "",
  email: "",
  role: "REQUESTER",
  siteIds: [],
};

export default function UsersAdminPage() {
  const { can } = useAuth();
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savingId, setSavingId] = useState("");
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [inviteForm, setInviteForm] = useState(emptyInviteForm);
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const [usersResponse, sitesResponse, invitesResponse] = await Promise.all([
        api.get("/api/users"),
        api.get("/api/sites"),
        api.get("/api/users/invites"),
      ]);
      setUsers(usersResponse.data);
      setSites(sitesResponse.data);
      setInvites(invitesResponse.data);
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

  function toggleSite(formSetter, siteId) {
    formSetter((current) => ({
      ...current,
      siteIds: current.siteIds.includes(siteId)
        ? current.siteIds.filter((id) => id !== siteId)
        : [...current.siteIds, siteId],
    }));
  }

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

  async function handleCreateUser(event) {
    event.preventDefault();
    if (!can("users:update")) return;
    setCreating(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        name: createForm.name || undefined,
        email: createForm.email,
        role: createForm.role,
        sendCredentials: createForm.sendCredentials,
      };
      if (createForm.password) payload.password = createForm.password;
      if (isSiteScopedRole(createForm.role)) payload.siteIds = createForm.siteIds;

      const response = await api.post("/api/users", payload);
      setCreateForm(emptyCreateForm);
      setNotice(
        `Created ${response.data.user.email}. Temporary password: ${response.data.temporaryPassword}` +
          (response.data.email?.sent ? " (also emailed)" : response.data.email?.skipped ? " (email not configured — copy password now)" : ""),
      );
      await loadUsers();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to create user"));
    } finally {
      setCreating(false);
    }
  }

  async function handleInvite(event) {
    event.preventDefault();
    if (!can("users:update")) return;
    setInviting(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        name: inviteForm.name || undefined,
        email: inviteForm.email,
        role: inviteForm.role,
      };
      if (isSiteScopedRole(inviteForm.role)) payload.siteIds = inviteForm.siteIds;

      const response = await api.post("/api/users/invites", payload);
      setInviteForm(emptyInviteForm);
      setNotice(
        response.data.email?.sent
          ? `Invite emailed to ${response.data.invite.email}.`
          : `Invite created. Share this link: ${response.data.invite.inviteUrl}`,
      );
      await loadUsers();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to send invite"));
    } finally {
      setInviting(false);
    }
  }

  async function handleRevokeInvite(inviteId) {
    setSavingId(inviteId);
    setError("");
    try {
      await api.delete(`/api/users/invites/${inviteId}`);
      await loadUsers();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to revoke invite"));
    } finally {
      setSavingId("");
    }
  }

  if (!can("users:read")) {
    return <ErrorBanner message="You do not have access to user management." />;
  }

  const canManage = can("users:update");

  return (
    <div className="space-y-6">
      <PageHeader
        title="User access"
        description="Add users with a temporary password, or invite them by email. Assign roles and site access."
      />
      <ErrorBanner message={error} />
      {notice ? (
        <div className="rounded-2xl border border-orange-800 bg-orange-950/60 px-4 py-3 text-sm text-orange-100">
          {notice}
        </div>
      ) : null}

      {canManage ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <form className="space-y-4 rounded-3xl border border-slate-600 bg-slate-800/90 p-6 shadow-sm" onSubmit={handleCreateUser}>
            <h3 className="text-lg font-semibold">Add user</h3>
            <p className="text-sm text-slate-400">Creates an active account immediately.</p>
            <FormField
              label="Name"
              name="name"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            />
            <FormField
              label="Email"
              name="email"
              type="email"
              required
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
            />
            <RoleSelect
              label="Role"
              value={createForm.role}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  role: e.target.value,
                  ...(isSiteScopedRole(e.target.value) ? {} : { siteIds: [] }),
                })
              }
              roles={ROLES}
            />
            <FormField
              label="Password (optional — auto-generated if blank)"
              name="password"
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
            />
            {isSiteScopedRole(createForm.role) ? (
              <div>
                <p className="text-sm font-medium text-slate-200">Sites</p>
                <div className="mt-2 space-y-2">
                  {sites.map((site) => (
                    <label key={site.id} className="flex items-center gap-2 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={createForm.siteIds.includes(site.id)}
                        onChange={() => toggleSite(setCreateForm, site.id)}
                      />
                      {site.name}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={createForm.sendCredentials}
                onChange={(e) => setCreateForm({ ...createForm, sendCredentials: e.target.checked })}
              />
              Email credentials if mail is configured
            </label>
            <button
              type="submit"
              disabled={creating || (isSiteScopedRole(createForm.role) && createForm.siteIds.length === 0)}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {creating ? "Creating..." : "Create user"}
            </button>
          </form>

          <form className="space-y-4 rounded-3xl border border-slate-600 bg-slate-800/90 p-6 shadow-sm" onSubmit={handleInvite}>
            <h3 className="text-lg font-semibold">Invite by email</h3>
            <p className="text-sm text-slate-400">
              Sends a link to set their password. If mail isn’t configured, you’ll get a shareable link.
            </p>
            <FormField
              label="Name"
              name="inviteName"
              value={inviteForm.name}
              onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
            />
            <FormField
              label="Email"
              name="inviteEmail"
              type="email"
              required
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
            />
            <RoleSelect
              label="Role"
              value={inviteForm.role}
              onChange={(e) =>
                setInviteForm({
                  ...inviteForm,
                  role: e.target.value,
                  ...(isSiteScopedRole(e.target.value) ? {} : { siteIds: [] }),
                })
              }
              roles={ROLES}
            />
            {isSiteScopedRole(inviteForm.role) ? (
              <div>
                <p className="text-sm font-medium text-slate-200">Sites</p>
                <div className="mt-2 space-y-2">
                  {sites.map((site) => (
                    <label key={site.id} className="flex items-center gap-2 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={inviteForm.siteIds.includes(site.id)}
                        onChange={() => toggleSite(setInviteForm, site.id)}
                      />
                      {site.name}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <button
              type="submit"
              disabled={inviting || (isSiteScopedRole(inviteForm.role) && inviteForm.siteIds.length === 0)}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {inviting ? "Sending..." : "Send invite"}
            </button>
          </form>
        </div>
      ) : null}

      {loading ? <LoadingState label="Loading users..." /> : null}

      {!loading && invites.length > 0 ? (
        <div className="overflow-hidden rounded-3xl border border-slate-600 bg-slate-800/90 shadow-sm">
          <div className="border-b border-slate-600 px-4 py-3">
            <h3 className="font-semibold">Pending invites</h3>
          </div>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-700/70 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Link</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr key={invite.id} className="border-t border-slate-700">
                  <td className="px-4 py-3">
                    <div className="font-medium">{invite.name || "—"}</div>
                    <div className="text-slate-300">{invite.email}</div>
                  </td>
                  <td className="px-4 py-3">{getRoleLabel(invite.role)}</td>
                  <td className="px-4 py-3 text-slate-300">{new Date(invite.expiresAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="text-xs font-medium text-orange-400 hover:underline"
                      onClick={() => navigator.clipboard?.writeText(invite.inviteUrl)}
                    >
                      Copy link
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <button
                        type="button"
                        disabled={savingId === invite.id}
                        onClick={() => handleRevokeInvite(invite.id)}
                        className="rounded-xl border border-slate-600 px-3 py-1.5 text-xs font-medium"
                      >
                        Revoke
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading ? (
        <div className="overflow-hidden rounded-3xl border border-slate-600 bg-slate-800/90 shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-700/70 text-xs uppercase tracking-wide text-slate-400">
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
                <tr key={user.id} className="border-t border-slate-700 align-top">
                  <td className="px-4 py-3 font-medium">{user.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-300">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                        user.status === "ACTIVE"
                          ? "bg-orange-950 text-orange-300"
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
                      disabled={!canManage || savingId === user.id}
                      showDescription={false}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {isSiteScopedRole(user.role) ? (
                      <div className="flex flex-col gap-2">
                        {sites.length === 0 ? (
                          <span className="text-slate-400">No sites available</span>
                        ) : (
                          sites.map((site) => (
                            <label key={site.id} className="flex items-center gap-2 text-slate-200">
                              <input
                                type="checkbox"
                                checked={(user.siteIds || []).includes(site.id)}
                                disabled={!canManage || savingId === user.id}
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
