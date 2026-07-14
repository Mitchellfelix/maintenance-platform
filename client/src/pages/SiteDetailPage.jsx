import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import FormField from "../components/FormField.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";

export default function SiteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, can } = useAuth();
  const [site, setSite] = useState(null);
  const [form, setForm] = useState({ name: "", address: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadSite() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get(`/api/sites/${id}`);
      setSite(response.data);
      setForm({ name: response.data.name, address: response.data.address || "" });
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load site"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSite();
  }, [id]);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSave(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await api.patch(`/api/sites/${id}`, form);
      setSite(response.data);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update site"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this site?")) return;
    setSubmitting(true);
    setError("");
    try {
      await api.delete(`/api/sites/${id}`);
      navigate("/sites");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to delete site"));
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState />;
  if (!site) return <ErrorBanner message={error || "Site not found"} />;

  return (
    <div>
      <PageHeader
        title={site.name}
        description={site.address || "No address provided"}
        action={
          <Link to="/sites" className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium">
            Back to sites
          </Link>
        }
      />

      <ErrorBanner message={error} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-600 bg-slate-800/90 p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Linked records</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Assets</dt>
              <dd className="font-medium">{site.assets?.length || 0}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Work orders</dt>
              <dd className="font-medium">{site.workOrders?.length || 0}</dd>
            </div>
          </dl>
        </section>

        {isAuthenticated && can("sites:write") ? (
          <form className="space-y-4 rounded-3xl border border-slate-600 bg-slate-800/90 p-6 shadow-sm" onSubmit={handleSave}>
            <h3 className="text-lg font-semibold">Edit site</h3>
            <FormField label="Site name" name="name" value={form.name} onChange={updateField} required />
            <FormField label="Address" name="address" value={form.address} onChange={updateField} />
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Save changes
              </button>
              {can("sites:delete") ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleDelete}
                  className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700"
                >
                  Delete site
                </button>
              ) : null}
            </div>
          </form>
        ) : (
          <section className="rounded-3xl border border-slate-600 bg-slate-800/90 p-6 shadow-sm">
            <p className="text-sm text-slate-400">
              {!isAuthenticated
                ? "Sign in to edit or delete this site."
                : "Ops Lead or Operator access is required to edit sites."}
            </p>
            {!isAuthenticated ? (
              <Link to="/login" className="mt-4 inline-flex rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white">
                Sign in
              </Link>
            ) : null}
          </section>
        )}
      </div>
    </div>
  );
}
