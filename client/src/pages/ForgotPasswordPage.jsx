import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import FormField from "../components/FormField.jsx";

export default function ForgotPasswordPage() {
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const response = await api.post("/api/auth/password-reset", { email });
      setSuccess(
        response.data.message ||
          "If an account exists for that email, a password reset link has been sent.",
      );
    } catch (err) {
      setError(getErrorMessage(err, "Unable to request password reset"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      <div className="flow-orb -left-16 top-10 h-72 w-72 bg-emerald-300/40" />
      <div className="flow-card relative w-full max-w-md p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">EMAT</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Forgot password</h1>
        <p className="mt-2 text-sm text-slate-300">
          Enter your email and we&apos;ll send a reset link if an active account exists. Mail must be
          configured on the server.
        </p>
        <ErrorBanner message={error} />
        {success ? (
          <div className="mt-4 rounded-xl border border-emerald-800 bg-emerald-950/60 px-4 py-3 text-sm text-emerald-100">
            {success}
          </div>
        ) : null}
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <FormField
            label="Email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Sending..." : "Send reset link"}
          </button>
        </form>
        <p className="mt-6 text-sm text-slate-300">
          <Link to="/login" className="font-medium text-emerald-700 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
