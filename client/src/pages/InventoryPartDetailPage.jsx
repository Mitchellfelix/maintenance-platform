import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import FormField from "../components/FormField.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { formatDate } from "../utils/labels.js";

export default function InventoryPartDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, can } = useAuth();
  const [part, setPart] = useState(null);
  const [assets, setAssets] = useState([]);
  const [form, setForm] = useState({
    assetId: "",
    partNumber: "",
    location: "",
    description: "",
    quantity: "1",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadPart() {
    setLoading(true);
    setError("");
    try {
      const [partResponse, assetsResponse] = await Promise.all([
        api.get(`/api/inventory/${id}`),
        api.get("/api/assets"),
      ]);
      setPart(partResponse.data);
      setAssets(assetsResponse.data);
      setForm({
        assetId: partResponse.data.assetId,
        partNumber: partResponse.data.partNumber,
        location: partResponse.data.location,
        description: partResponse.data.description || "",
        quantity: String(partResponse.data.quantity ?? 1),
      });
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load inventory part"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPart();
  }, [id]);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSave(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await api.patch(`/api/inventory/${id}`, {
        assetId: form.assetId,
        partNumber: form.partNumber.trim(),
        location: form.location.trim(),
        description: form.description.trim() || null,
        quantity: Number(form.quantity) || 1,
      });
      setPart(response.data);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update inventory part"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this inventory part?")) return;
    setSubmitting(true);
    setError("");
    try {
      await api.delete(`/api/inventory/${id}`);
      navigate("/inventory");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to delete inventory part"));
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState label="Loading inventory part..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={part?.partNumber || "Inventory part"}
        description={
          part
            ? `${part.asset?.name || "Unit"} · ${part.location} · Added ${formatDate(part.createdAt)}`
            : ""
        }
      />
      <ErrorBanner message={error} />

      {!part ? (
        <p className="text-sm text-slate-400">
          Part not found.{" "}
          <Link to="/inventory" className="font-medium text-emerald-400">
            Back to inventory
          </Link>
        </p>
      ) : null}

      {part && isAuthenticated && can("inventory:write") ? (
        <form
          onSubmit={handleSave}
          className="grid gap-4 rounded-3xl border border-slate-600 bg-slate-800/90 p-6 shadow-sm md:grid-cols-2"
        >
          <FormField
            label="Unit (asset)"
            name="assetId"
            as="select"
            value={form.assetId}
            onChange={updateField}
            options={assets.map((asset) => ({ value: asset.id, label: asset.name }))}
            required
          />
          <FormField label="Part number" name="partNumber" value={form.partNumber} onChange={updateField} required />
          <FormField label="Part location" name="location" value={form.location} onChange={updateField} required />
          <FormField
            label="Quantity"
            name="quantity"
            type="number"
            min="1"
            value={form.quantity}
            onChange={updateField}
            required
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
          <div className="flex flex-wrap gap-3 md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Save changes"}
            </button>
            {can("inventory:delete") ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 disabled:opacity-60"
              >
                Delete part
              </button>
            ) : null}
            <Link to="/inventory" className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200">
              Back to inventory
            </Link>
          </div>
        </form>
      ) : part ? (
        <div className="rounded-3xl border border-slate-600 bg-slate-800/90 p-6 shadow-sm">
          <dl className="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <dt className="text-slate-400">Unit</dt>
              <dd className="font-medium">{part.asset?.name}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Site</dt>
              <dd className="font-medium">{part.asset?.site?.name || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Part location</dt>
              <dd className="font-medium">{part.location}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Quantity</dt>
              <dd className="font-medium">{part.quantity}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-slate-400">Description</dt>
              <dd className="font-medium">{part.description || "—"}</dd>
            </div>
          </dl>
          {!isAuthenticated ? (
            <Link to="/login" className="mt-4 inline-flex rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white">
              Sign in to edit
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
