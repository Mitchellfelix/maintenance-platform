import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import FormField from "../components/FormField.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader, { EmptyState, RecordLink } from "../components/PageHeader.jsx";

const statusOptions = [
  { value: "OPERATIONAL", label: "Operational" },
  { value: "DEGRADED", label: "Degraded" },
  { value: "OFFLINE", label: "Offline" },
  { value: "DECOMMISSIONED", label: "Decommissioned" },
];

const emptyForm = {
  siteId: "",
  name: "",
  description: "",
  serialNumber: "",
  operationalStatus: "OPERATIONAL",
};

export default function AssetsPage() {
  const { isAuthenticated, can } = useAuth();
  const [assets, setAssets] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [assetsResponse, sitesResponse] = await Promise.all([
        api.get("/api/assets"),
        api.get("/api/sites"),
      ]);
      setAssets(assetsResponse.data);
      setSites(sitesResponse.data);
      if (!form.siteId && sitesResponse.data[0]) {
        setForm((current) => ({ ...current, siteId: sitesResponse.data[0].id }));
      }
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load assets"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        ...form,
        description: form.description || undefined,
        serialNumber: form.serialNumber || undefined,
      };
      await api.post("/api/assets", payload);
      setForm((current) => ({ ...emptyForm, siteId: current.siteId }));
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to create asset"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Assets"
        description="Track equipment status and linked maintenance work."
        action={
          !isAuthenticated ? (
            <Link to="/login" className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white">
              Sign in to create
            </Link>
          ) : !can("assets:write") ? (
            <span className="text-sm text-slate-400">Ops Lead or Operator access required to create</span>
          ) : null
        }
      />

      <ErrorBanner message={error} />

      {isAuthenticated && can("assets:write") ? (
        <form className="mb-6 grid gap-4 rounded-3xl border border-slate-600 bg-slate-800/90 p-6 shadow-sm md:grid-cols-2" onSubmit={handleCreate}>
          <FormField
            label="Site"
            name="siteId"
            as="select"
            value={form.siteId}
            onChange={updateField}
            options={sites.map((site) => ({ value: site.id, label: site.name }))}
            required
          />
          <FormField label="Asset name" name="name" value={form.name} onChange={updateField} required />
          <FormField label="Serial number" name="serialNumber" value={form.serialNumber} onChange={updateField} />
          <FormField
            label="Operational status"
            name="operationalStatus"
            as="select"
            value={form.operationalStatus}
            onChange={updateField}
            options={statusOptions}
          />
          <div className="md:col-span-2">
            <FormField
              label="Description"
              name="description"
              as="textarea"
              value={form.description}
              onChange={updateField}
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting || sites.length === 0}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "Creating..." : "Create asset"}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? <LoadingState /> : null}
      {!loading && assets.length === 0 ? <EmptyState message="No assets yet." /> : null}
      {!loading && assets.length > 0 ? (
        <div className="grid gap-4">
          {assets.map((asset) => (
            <RecordLink
              key={asset.id}
              to={`/assets/${asset.id}`}
              title={asset.name}
              subtitle={[asset.site?.name, asset.serialNumber].filter(Boolean).join(" · ")}
              badge={asset.operationalStatus}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
