import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import FormField from "../components/FormField.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader, { EmptyState, RecordLink } from "../components/PageHeader.jsx";

export default function SitesPage() {
  const { isAuthenticated, can } = useAuth();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", address: "" });
  const [submitting, setSubmitting] = useState(false);

  async function loadSites() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/api/sites");
      setSites(response.data);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load sites"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSites();
  }, []);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.post("/api/sites", form);
      setForm({ name: "", address: "" });
      await loadSites();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to create site"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Sites"
        description="Manage locations where assets and work orders are tracked."
        action={
          !isAuthenticated ? (
            <Link to="/login" className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white">
              Sign in to create
            </Link>
          ) : !can("sites:write") ? (
            <span className="text-sm text-slate-500">Ops Lead or Operator access required to create</span>
          ) : null
        }
      />

      <ErrorBanner message={error} />

      {isAuthenticated && can("sites:write") ? (
        <form className="mb-6 grid gap-4 rounded-3xl border border-slate-300 bg-slate-200 p-6 shadow-sm md:grid-cols-2" onSubmit={handleCreate}>
          <FormField label="Site name" name="name" value={form.name} onChange={updateField} required />
          <FormField label="Address" name="address" value={form.address} onChange={updateField} />
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "Creating..." : "Create site"}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? <LoadingState /> : null}
      {!loading && sites.length === 0 ? <EmptyState message="No sites yet." /> : null}
      {!loading && sites.length > 0 ? (
        <div className="grid gap-4">
          {sites.map((site) => (
            <RecordLink
              key={site.id}
              to={`/sites/${site.id}`}
              title={site.name}
              subtitle={[site.address, `${site._count?.assets || 0} assets`, `${site._count?.workOrders || 0} work orders`]
                .filter(Boolean)
                .join(" · ")}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
