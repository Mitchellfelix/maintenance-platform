import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import FormField from "../components/FormField.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader, { EmptyState, RecordLink } from "../components/PageHeader.jsx";

const emptyForm = {
  assetId: "",
  partNumber: "",
  location: "",
  description: "",
  quantity: "1",
};

export default function InventoryPage() {
  const { isAuthenticated, can } = useAuth();
  const [searchParams] = useSearchParams();
  const initialAssetFilter = searchParams.get("assetId") || "";
  const [parts, setParts] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [assetFilter, setAssetFilter] = useState(initialAssetFilter);

  useEffect(() => {
    setAssetFilter(initialAssetFilter);
  }, [initialAssetFilter]);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const query = assetFilter ? `?assetId=${assetFilter}` : "";
      const [partsResponse, assetsResponse] = await Promise.all([
        api.get(`/api/inventory${query}`),
        api.get("/api/assets"),
      ]);
      setParts(partsResponse.data);
      setAssets(assetsResponse.data);
      if (!form.assetId && (assetFilter || assetsResponse.data[0])) {
        setForm((current) => ({
          ...current,
          assetId: assetFilter || assetsResponse.data[0]?.id || "",
        }));
      }
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load inventory"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [assetFilter]);

  const assetOptions = useMemo(
    () => assets.map((asset) => ({ value: asset.id, label: asset.name })),
    [assets],
  );

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        assetId: form.assetId,
        partNumber: form.partNumber.trim(),
        location: form.location.trim(),
        description: form.description.trim() || undefined,
        quantity: Number(form.quantity) || 1,
      };
      await api.post("/api/inventory", payload);
      setForm((current) => ({
        ...emptyForm,
        assetId: current.assetId,
      }));
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to add inventory part"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Track part numbers and storage locations for each unit."
        action={
          !isAuthenticated ? (
            <Link to="/login" className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white">
              Sign in to manage
            </Link>
          ) : !can("inventory:write") ? (
            <span className="text-sm text-slate-400">Ops Lead or Operator access required to add parts</span>
          ) : null
        }
      />

      <ErrorBanner message={error} />

      <div className="mb-6 rounded-3xl border border-slate-600 bg-slate-800/90 p-4 shadow-sm">
        <label className="block text-sm font-medium text-slate-200">
          Filter by unit
          <select
            value={assetFilter}
            onChange={(event) => setAssetFilter(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-600 px-3 py-2 text-sm md:max-w-sm"
          >
            <option value="">All units</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isAuthenticated && can("inventory:write") ? (
        <form
          className="mb-6 grid gap-4 rounded-3xl border border-slate-600 bg-slate-800/90 p-6 shadow-sm md:grid-cols-2"
          onSubmit={handleCreate}
        >
          <FormField
            label="Unit (asset)"
            name="assetId"
            as="select"
            value={form.assetId}
            onChange={updateField}
            options={assetOptions}
            required
          />
          <FormField
            label="Part number"
            name="partNumber"
            value={form.partNumber}
            onChange={updateField}
            placeholder="e.g. PN-12345"
            required
          />
          <FormField
            label="Part location"
            name="location"
            value={form.location}
            onChange={updateField}
            placeholder="e.g. Cabinet A, Shelf 2"
            required
          />
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
              placeholder="Optional notes about this part"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting || assets.length === 0}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "Adding..." : "Add part"}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? <LoadingState /> : null}
      {!loading && parts.length === 0 ? <EmptyState message="No inventory parts recorded yet." /> : null}
      {!loading && parts.length > 0 ? (
        <div className="grid gap-4">
          {parts.map((part) => (
            <RecordLink
              key={part.id}
              to={`/inventory/${part.id}`}
              title={part.partNumber}
              subtitle={[
                part.asset?.name,
                part.location,
                part.quantity > 1 ? `Qty ${part.quantity}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              badge={part.asset?.site?.name}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
