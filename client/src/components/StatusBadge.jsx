import { statusLabel } from "../utils/labels.js";

const toneByValue = {
  OPERATIONAL: "bg-emerald-100 text-emerald-800",
  OPEN: "bg-sky-100 text-sky-800",
  IN_PROGRESS: "bg-indigo-100 text-indigo-800",
  ON_HOLD: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-200 text-slate-700",
  CRITICAL: "bg-rose-100 text-rose-800",
  HIGH: "bg-orange-100 text-orange-800",
  MEDIUM: "bg-amber-100 text-amber-800",
  LOW: "bg-slate-100 text-slate-700",
  DEGRADED: "bg-amber-100 text-amber-800",
  OFFLINE: "bg-rose-100 text-rose-800",
  DECOMMISSIONED: "bg-slate-200 text-slate-700",
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
};

export default function StatusBadge({ value }) {
  const tone = toneByValue[value] || "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ring-black/5 ${tone}`}>
      {statusLabel(value)}
    </span>
  );
}
