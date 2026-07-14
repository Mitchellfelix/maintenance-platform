import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import FormField from "../components/FormField.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { formatDate } from "../utils/labels.js";

const statusOptions = [
  { value: "OPERATIONAL", label: "Operational" },
  { value: "DEGRADED", label: "Degraded" },
  { value: "OFFLINE", label: "Offline" },
  { value: "DECOMMISSIONED", label: "Decommissioned" },
];

export default function AssetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, can } = useAuth();
  const [asset, setAsset] = useState(null);
  const [sites, setSites] = useState([]);
  const [form, setForm] = useState({
    siteId: "",
    name: "",
    description: "",
    serialNumber: "",
    operationalStatus: "OPERATIONAL",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inventoryParts, setInventoryParts] = useState([]);

  async function loadAsset() {
    setLoading(true);
    setError("");
    try {
      const [assetResponse, sitesResponse, inventoryResponse] = await Promise.all([
        api.get(`/api/assets/${id}`),
        api.get("/api/sites"),
        api.get(`/api/inventory?assetId=${id}`),
      ]);
      setAsset(assetResponse.data);
      setSites(sitesResponse.data);
      setInventoryParts(inventoryResponse.data);
      setForm({
        siteId: assetResponse.data.siteId,
        name: assetResponse.data.name,
        description: assetResponse.data.description || "",
        serialNumber: assetResponse.data.serialNumber || "",
        operationalStatus: assetResponse.data.operationalStatus,
      });
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load asset"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAsset();
  }, [id]);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSave(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await api.patch(`/api/assets/${id}`, {
        ...form,
        description: form.description || null,
        serialNumber: form.serialNumber || null,
      });
      setAsset(response.data);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update asset"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this asset?")) return;
    setSubmitting(true);
    setError("");
    try {
      await api.delete(`/api/assets/${id}`);
      navigate("/assets");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to delete asset"));
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState />;
  if (!asset) return <ErrorBanner message={error || "Asset not found"} />;

  return (
    <div>
      <PageHeader
        title={asset.name}
        description={asset.site?.name || "Unknown site"}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge value={asset.operationalStatus} />
            <Link
              to={`/greentagging?assetId=${asset.id}`}
              className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium"
            >
              Greentagging
            </Link>
            <Link to="/assets" className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium">
              Back to assets
            </Link>
          </div>
        }
      />

      <ErrorBanner message={error} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-600 bg-slate-800/90 p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Details</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Serial number</dt>
              <dd className="font-medium">{asset.serialNumber || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Installed</dt>
              <dd className="font-medium">{formatDate(asset.installedAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Work orders</dt>
              <dd className="font-medium">{asset.workOrders?.length || 0}</dd>
            </div>
          </dl>
          {asset.description ? <p className="mt-4 text-sm text-slate-300">{asset.description}</p> : null}
        </section>

        {isAuthenticated && can("assets:write") ? (
          <form className="space-y-4 rounded-3xl border border-slate-600 bg-slate-800/90 p-6 shadow-sm" onSubmit={handleSave}>
            <h3 className="text-lg font-semibold">Edit asset</h3>
            <FormField
              label="Site"
              name="siteId"
              as="select"
              value={form.siteId}
              onChange={updateField}
              options={sites.map((site) => ({ value: site.id, label: site.name }))}
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
            <FormField
              label="Description"
              name="description"
              as="textarea"
              value={form.description}
              onChange={updateField}
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Save changes
              </button>
              {can("assets:delete") ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleDelete}
                  className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700"
                >
                  Delete asset
                </button>
              ) : null}
            </div>
          </form>
        ) : (
          <section className="rounded-3xl border border-slate-600 bg-slate-800/90 p-6 shadow-sm">
            <p className="text-sm text-slate-400">
              {!isAuthenticated
                ? "Sign in to edit or delete this asset."
                : "Ops Lead or Operator access is required to edit assets."}
            </p>
            {!isAuthenticated ? (
              <Link to="/login" className="mt-4 inline-flex rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white">
                Sign in
              </Link>
            ) : null}
          </section>
        )}
      </div>

      <section className="mt-6 rounded-3xl border border-slate-600 bg-slate-800/90 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Inventory parts</h3>
          <Link
            to={`/inventory?assetId=${id}`}
            className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200"
          >
            Manage inventory
          </Link>
        </div>
        {inventoryParts.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No parts recorded for this unit yet.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-700/70 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Part number</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Qty</th>
                </tr>
              </thead>
              <tbody>
                {inventoryParts.map((part) => (
                  <tr key={part.id} className="border-t border-slate-700">
                    <td className="px-4 py-3">
                      <Link to={`/inventory/${part.id}`} className="font-medium text-orange-400 hover:underline">
                        {part.partNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{part.location}</td>
                    <td className="px-4 py-3 text-slate-300">{part.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
