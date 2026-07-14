import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import FormField from "../components/FormField.jsx";
import LoadingState from "../components/LoadingState.jsx";

export default function ResetPasswordPage() {
  const { token } = useParams();
  const { completePasswordReset, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ password: "", confirmPassword: "" });

  useEffect(() => {
    let cancelled = false;
    async function loadPreview() {
      setLoading(true);
      setError("");
      try {
        const response = await api.get(`/api/auth/password-reset/${token}`);
        if (!cancelled) setPreview(response.data);
      } catch (err) {
        if (!cancelled) {
          setPreview(null);
          setError(getErrorMessage(err, "This reset link is invalid or expired"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadPreview();
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
      await completePasswordReset(token, form.password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Unable to reset password"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-300 px-4 py-10">
      <div className="flow-orb -left-16 top-10 h-72 w-72 bg-emerald-300/40" />
      <div className="flow-card relative w-full max-w-md p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">EMAT</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Choose a new password</h1>
        {loading ? <LoadingState label="Checking reset link..." /> : null}
        <ErrorBanner message={error} />
        {!loading && preview ? (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <p className="text-sm text-slate-600">
              Resetting password for <span className="font-medium">{preview.email}</span>
            </p>
            <FormField
              label="New password"
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
              {submitting ? "Saving..." : "Update password"}
            </button>
          </form>
        ) : null}
        {!loading && !preview ? (
          <p className="mt-4 text-sm text-slate-600">
            <Link to="/forgot-password" className="font-medium text-emerald-700 hover:underline">
              Request a new reset link
            </Link>
            {" · "}
            <Link to="/login" className="font-medium text-emerald-700 hover:underline">
              Sign in
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
