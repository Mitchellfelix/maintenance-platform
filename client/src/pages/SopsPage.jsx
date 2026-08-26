import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import FormField from "../components/FormField.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader, { EmptyState } from "../components/PageHeader.jsx";

const DEPARTMENT_OPTIONS = [
  "Operations",
  "Field Ops",
  "Maintenance",
  "Safety",
  "Quality",
  "Logistics",
  "Engineering",
];

const emptyForm = {
  title: "",
  department: DEPARTMENT_OPTIONS[0],
  summary: "",
  content: "",
  documentUrl: "",
  version: "1.0",
};

export default function SopsPage() {
  const { isAuthenticated, can } = useAuth();
  const [sops, setSops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [copiedSopId, setCopiedSopId] = useState("");

  async function loadSops() {
    setLoading(true);
    setError("");
    try {
      const query = departmentFilter ? `?department=${encodeURIComponent(departmentFilter)}` : "";
      const response = await api.get(`/api/sops${query}`);
      setSops(response.data);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load SOPs"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSops();
  }, [departmentFilter]);

  const departments = useMemo(() => {
    const fromData = [...new Set(sops.map((sop) => sop.department))];
    return [...new Set([...DEPARTMENT_OPTIONS, ...fromData])].sort();
  }, [sops]);

  const groupedSops = useMemo(() => {
    const groups = new Map();
    for (const sop of sops) {
      const list = groups.get(sop.department) || [];
      list.push(sop);
      groups.set(sop.department, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [sops]);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        title: form.title.trim(),
        department: form.department.trim(),
        summary: form.summary.trim() || undefined,
        content: form.content.trim() || undefined,
        documentUrl: form.documentUrl.trim() || undefined,
        version: form.version.trim() || "1.0",
      };
      await api.post("/api/sops", payload);
      setForm(emptyForm);
      await loadSops();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to create SOP"));
    } finally {
      setSubmitting(false);
    }
  }

  async function copyDocumentLink(sopId, url) {
    if (!url) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = url;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "absolute";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopiedSopId(sopId);
      window.setTimeout(() => setCopiedSopId(""), 1600);
    } catch {
      setError("Could not copy link. Please copy it from the SOP detail page.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Department SOPs"
        description="Standard operating procedures organized by department. Everyone can view; Ops Leads and Admins can publish and update."
        action={
          !isAuthenticated ? (
            <Link to="/login" className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white">
              Sign in to add SOPs
            </Link>
          ) : !can("sops:write") ? (
            <span className="text-sm text-slate-400">Ops Lead access required to publish SOPs</span>
          ) : null
        }
      />

      <ErrorBanner message={error} />

      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-3xl border border-slate-600 bg-slate-800/90 p-4 shadow-sm">
        <div className="min-w-[12rem] flex-1">
          <label className="text-sm font-medium text-slate-200" htmlFor="departmentFilter">
            Filter by department
          </label>
          <select
            id="departmentFilter"
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
            className="flow-input"
          >
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isAuthenticated && can("sops:write") ? (
        <form
          className="mb-6 grid gap-4 rounded-3xl border border-slate-600 bg-slate-800/90 p-6 shadow-sm md:grid-cols-2"
          onSubmit={handleCreate}
        >
          <h3 className="text-lg font-semibold md:col-span-2">Add SOP</h3>
          <FormField label="Title" name="title" value={form.title} onChange={updateField} required />
          <div>
            <label className="text-sm font-medium text-slate-200" htmlFor="department">
              Department
            </label>
            <input
              id="department"
              name="department"
              list="department-options"
              value={form.department}
              onChange={updateField}
              required
              className="flow-input"
            />
            <datalist id="department-options">
              {DEPARTMENT_OPTIONS.map((department) => (
                <option key={department} value={department} />
              ))}
            </datalist>
          </div>
          <FormField label="Version" name="version" value={form.version} onChange={updateField} />
          <FormField
            label="Document link (optional)"
            name="documentUrl"
            type="url"
            value={form.documentUrl}
            onChange={updateField}
            placeholder="https://..."
          />
          <FormField label="Summary" name="summary" value={form.summary} onChange={updateField} />
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-200" htmlFor="content">
              Procedure content
            </label>
            <textarea
              id="content"
              name="content"
              rows={5}
              value={form.content}
              onChange={updateField}
              className="flow-input"
              placeholder="Step-by-step instructions, or leave blank if the document link is the source of truth."
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "Publishing..." : "Publish SOP"}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? <LoadingState label="Loading SOPs..." /> : null}
      {!loading && sops.length === 0 ? (
        <EmptyState message="No SOPs published yet for this department." />
      ) : null}
      {!loading && sops.length > 0 ? (
        <div className="space-y-8">
          {groupedSops.map(([department, items]) => (
            <section key={department}>
              <h3 className="mb-3 text-lg font-semibold text-slate-100">{department}</h3>
              <div className="grid gap-4">
                {items.map((sop) => (
                  <div key={sop.id} className="flow-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={`/sops/${sop.id}`} className="min-w-0 flex-1 transition-opacity hover:opacity-90">
                        <p className="font-medium">{sop.title}</p>
                        <p className="mt-1 text-sm text-slate-400">
                          {[sop.summary, `v${sop.version}`].filter(Boolean).join(" · ")}
                        </p>
                      </Link>
                      {sop.documentUrl ? (
                        <div className="flex shrink-0 items-center gap-2">
                          <a
                            href={sop.documentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-orange-400/40 px-3 py-1.5 text-xs font-semibold text-orange-300 hover:bg-orange-400/10"
                            title="Open document in Google Drive"
                          >
                            Open in Google Drive
                          </a>
                          <button
                            type="button"
                            onClick={() => copyDocumentLink(sop.id, sop.documentUrl)}
                            className="rounded-lg border border-slate-500 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700/50"
                            title="Copy document link"
                          >
                            {copiedSopId === sop.id ? "Copied" : "Copy link"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
