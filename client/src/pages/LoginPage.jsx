import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import FormField from "../components/FormField.jsx";
import RoleSelect from "../components/RoleSelect.jsx";
import { REGISTRATION_ROLES } from "../lib/permissions.js";

export default function LoginPage() {
  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    requestedRole: "REQUESTER",
    reason: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [version, setVersion] = useState("");

  useEffect(() => {
    api
      .get("/api/version")
      .then((response) => setVersion(response.data.version || ""))
      .catch(() => setVersion(""));
  }, []);

  if (isAuthenticated) {
    return <Navigate to={location.state?.from || "/"} replace />;
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
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

      const result = await register({
        email: form.email,
        password: form.password,
        name: form.name,
        requestedRole: form.requestedRole,
        reason: form.reason || undefined,
      });
      if (result.pendingApproval) {
        setSuccess(
          result.message ||
            "Your account is pending admin approval. An admin will assign your role and sites, then you can sign in.",
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
    <div className="relative flex min-h-screen justify-center overflow-y-auto bg-slate-950 px-4 py-8">
      <div className="flow-orb -left-20 top-0 h-96 w-96 bg-orange-500/20" />
      <div className="flow-orb right-0 top-1/4 h-80 w-80 bg-sky-500/15 [animation-delay:-4s]" />

      <div className="flow-page relative mx-auto my-auto flex w-full max-w-md max-h-[calc(100dvh-4rem)] flex-col rounded-[2rem] border border-slate-600 bg-slate-900/95 p-8 shadow-[0_20px_60px_rgb(2,6,23,0.55)] backdrop-blur-md">
        <div className="shrink-0">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-orange-400">
            EMAT Tracking Database
          </p>
          {version ? <p className="mt-2 text-xs text-slate-500">V{version}</p> : null}
          <h2 className="mt-3 text-3xl font-bold">{mode === "login" ? "Sign in" : "Request access"}</h2>
          <p className="mt-2 text-sm text-slate-400">
            {mode === "login"
              ? "Use your account after an admin has approved your access request."
              : "Submit a request. An admin approves it and assigns sites — no site selection needed here."}
          </p>

          <div className="mt-6 flex gap-2 rounded-2xl bg-slate-700/80 p-1">
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
                  mode === value ? "bg-slate-800 text-slate-100 shadow-sm" : "text-slate-400",
                ].join(" ")}
              >
                {value === "register" ? "Request access" : value}
              </button>
            ))}
          </div>
        </div>

        <form className="mt-6 flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1">
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
                <Link to="/forgot-password" className="text-sm font-medium text-orange-400 hover:underline">
                  Forgot password?
                </Link>
              </div>
            ) : null}
          </div>

          <div className="mt-4 shrink-0 space-y-3 border-t border-slate-700/80 pt-4">
            <ErrorBanner message={error} />
            {success ? (
              <div className="rounded-xl border border-orange-800 bg-orange-950/60 px-4 py-3 text-sm text-orange-100">
                {success}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
            >
              {submitting
                ? "Please wait..."
                : mode === "login"
                  ? "Sign in"
                  : "Submit access request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
