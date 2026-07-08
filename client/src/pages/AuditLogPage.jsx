import { useEffect, useState } from "react";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";
import LoadingState from "../components/LoadingState.jsx";
import PageHeader from "../components/PageHeader.jsx";

function formatAction(action) {
  return action.replace(/\./g, " · ").replace(/_/g, " ");
}

function formatMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return "—";
  try {
    return JSON.stringify(metadata);
  } catch {
    return "—";
  }
}

export default function AuditLogPage() {
  const { can } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!can("audit:read")) return;

    async function loadLogs() {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/api/audit-logs");
        setLogs(response.data);
      } catch (err) {
        setError(getErrorMessage(err, "Unable to load audit log"));
      } finally {
        setLoading(false);
      }
    }

    loadLogs();
  }, [can]);

  if (!can("audit:read")) {
    return <ErrorBanner message="You do not have access to the audit log." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Recent changes across sites, assets, work orders, and user access."
      />
      <ErrorBanner message={error} />
      {loading ? <LoadingState label="Loading audit log..." /> : null}
      {!loading ? (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No audit entries yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-t border-slate-100 align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium capitalize">{formatAction(log.action)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {log.entityType}
                      {log.entityId ? (
                        <span className="mt-1 block font-mono text-xs text-slate-400">{log.entityId}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {log.actor?.name || log.actor?.email || "—"}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 font-mono text-xs text-slate-500">
                      {formatMetadata(log.metadata)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
