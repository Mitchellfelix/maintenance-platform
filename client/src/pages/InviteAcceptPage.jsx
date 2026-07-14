import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import FormField from "../components/FormField.jsx";
import LoadingState from "../components/LoadingState.jsx";
import { getRoleLabel } from "../lib/permissions.js";

export default function InviteAcceptPage() {
  const { token } = useParams();
  const { acceptInvite, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", password: "", confirmPassword: "" });

  useEffect(() => {
    let cancelled = false;
    async function loadInvite() {
      setLoading(true);
      setError("");
      try {
        const response = await api.get(`/api/auth/invites/${token}`);
        if (!cancelled) {
          setInvite(response.data);
          setForm((current) => ({ ...current, name: response.data.name || "" }));
        }
      } catch (err) {
        if (!cancelled) {
          setInvite(null);
          setError(getErrorMessage(err, "This invite is invalid or expired"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadInvite();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await acceptInvite(token, {
        password: form.password,
        name: form.name || undefined,
      });
      navigate("/", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Unable to accept invite"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      <div className="flow-orb -left-16 top-10 h-72 w-72 bg-emerald-300/40" />
      <div className="flow-card relative w-full max-w-md p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">EMAT</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Accept invite</h1>
        {loading ? <LoadingState label="Loading invite..." /> : null}
        <ErrorBanner message={error} />
        {!loading && invite ? (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <p className="text-sm text-slate-300">
              You’re joining as <span className="font-medium">{getRoleLabel(invite.role)}</span>
              {" · "}
              {invite.email}
            </p>
            <FormField label="Name" name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <FormField
              label="Password"
              name="password"
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <FormField
              label="Confirm password"
              name="confirmPassword"
              type="password"
              required
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "Creating account..." : "Create account"}
            </button>
          </form>
        ) : null}
        {!loading && !invite ? (
          <p className="mt-4 text-sm text-slate-300">
            <Link to="/login" className="font-medium text-emerald-700 hover:underline">
              Back to sign in
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
