import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import FormField from "../components/FormField.jsx";
import RoleSelect from "../components/RoleSelect.jsx";
import { REGISTRATION_ROLES, isSiteScopedRole } from "../lib/permissions.js";

export default function LoginPage() {
  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState("login");
  const [sites, setSites] = useState([]);
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    requestedRole: "REQUESTER",
    requestedSiteIds: [],
    reason: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (mode !== "register") return;

    api
      .get("/api/sites")
      .then((response) => setSites(response.data))
      .catch(() => setSites([]));
  }, [mode]);

  if (isAuthenticated) {
    return <Navigate to={location.state?.from || "/"} replace />;
  }

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
    setSuccess("");

    try {
      if (mode === "login") {
        await login(form.email, form.password);
        navigate(location.state?.from || "/");
        return;
      }

      const payload = {
        email: form.email,
        password: form.password,
        name: form.name,
        requestedRole: form.requestedRole,
        reason: form.reason || undefined,
      };
      if (isSiteScopedRole(form.requestedRole)) {
        payload.requestedSiteIds = form.requestedSiteIds;
      }

      const result = await register(payload);
      if (result.pendingApproval) {
        setSuccess(
          result.message ||
            "Your account is pending admin approval. You can sign in after an admin approves your request.",
        );
        setMode("login");
        return;
      }

      navigate(location.state?.from || "/");
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (err?.response?.status === 403
          ? "Your account is pending admin approval."
          : null) ||
        "Unable to sign in";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-300 px-4 py-8">
      <div className="flow-orb -left-20 top-0 h-96 w-96 bg-emerald-300/35" />
      <div className="flow-orb right-0 top-1/4 h-80 w-80 bg-sky-200/30 [animation-delay:-4s]" />

      <div className="flow-page relative mx-auto w-full max-w-md rounded-[2rem] border border-slate-300 bg-slate-200/95 p-8 shadow-[0_20px_60px_rgb(15,23,42,0.12)] backdrop-blur-md">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-emerald-600">
          EMAT Tracking Database
        </p>
        <h2 className="mt-3 text-3xl font-bold">{mode === "login" ? "Sign in" : "Request access"}</h2>
        <p className="mt-2 text-sm text-slate-500">
          {mode === "login"
            ? "Use your account after an admin has approved your access request."
            : "Create an account request. An admin must approve it before you can sign in."}
        </p>

        <div className="mt-6 flex gap-2 rounded-2xl bg-slate-300/80 p-1">
          {["login", "register"].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value);
                setError("");
                setSuccess("");
              }}
              className={[
                "flex-1 rounded-xl px-3 py-2 text-sm font-medium capitalize",
                mode === value ? "bg-slate-100 text-slate-950 shadow-sm" : "text-slate-500",
              ].join(" ")}
            >
              {value === "register" ? "Request access" : value}
            </button>
          ))}
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {mode === "register" ? (
            <>
              <FormField label="Name" name="name" value={form.name} onChange={updateField} required />
              <RoleSelect
                label="Requested role"
                name="requestedRole"
                value={form.requestedRole}
                onChange={updateField}
                roles={REGISTRATION_ROLES}
                required
              />
              {isSiteScopedRole(form.requestedRole) ? (
                <div>
                  <p className="text-sm font-medium text-slate-700">Sites</p>
                  <div className="mt-2 space-y-2">
                    {sites.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        No sites available yet. Choose Requester, or ask an admin to add sites first.
                      </p>
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
              <FormField
                label="Reason"
                name="reason"
                as="textarea"
                value={form.reason}
                onChange={updateField}
                placeholder="Why do you need access?"
              />
            </>
          ) : null}
          <FormField
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={updateField}
            required
          />
          <FormField
            label="Password"
            name="password"
            type="password"
            value={form.password}
            onChange={updateField}
            required
          />
          {mode === "login" ? (
            <div className="-mt-2 text-right">
              <Link to="/forgot-password" className="text-sm font-medium text-emerald-700 hover:underline">
                Forgot password?
              </Link>
            </div>
          ) : null}

          <ErrorBanner message={error} />
          {success ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {success}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={
              submitting ||
              (mode === "register" &&
                isSiteScopedRole(form.requestedRole) &&
                form.requestedSiteIds.length === 0)
            }
            className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
          >
            {submitting
              ? "Please wait..."
              : mode === "login"
                ? "Sign in"
                : "Submit access request"}
          </button>
        </form>
      </div>
    </div>
  );
}
