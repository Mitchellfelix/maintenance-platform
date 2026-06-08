import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import FormField from "../components/FormField.jsx";

export default function LoginPage() {
  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to={location.state?.from || "/"} replace />;
  }

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (mode === "login") {
        await login(form.email, form.password);
      } else {
        await register(form.email, form.password, form.name);
      }
      navigate(location.state?.from || "/");
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || "Unable to sign in");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.35em] text-emerald-600">Maintenance Platform</p>
      <h2 className="mt-3 text-3xl font-bold">{mode === "login" ? "Sign in" : "Create account"}</h2>
      <p className="mt-2 text-sm text-slate-500">
        {mode === "login"
          ? "Use your account to create sites, assets, and work orders."
          : "Register to start managing maintenance records."}
      </p>

      <div className="mt-6 flex gap-2 rounded-2xl bg-slate-100 p-1">
        {["login", "register"].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={[
              "flex-1 rounded-xl px-3 py-2 text-sm font-medium capitalize",
              mode === value ? "bg-white text-slate-950 shadow-sm" : "text-slate-500",
            ].join(" ")}
          >
            {value}
          </button>
        ))}
      </div>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {mode === "register" ? (
          <FormField label="Name" name="name" value={form.name} onChange={updateField} required />
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

        <ErrorBanner message={error} />

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
        >
          {submitting ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>

      <Link to="/" className="mt-6 inline-block text-sm text-slate-500 hover:text-slate-800">
        Back to dashboard
      </Link>
      </div>
    </div>
  );
}
