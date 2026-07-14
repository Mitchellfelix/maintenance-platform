import { statusLabel } from "../utils/labels.js";

const toneByValue = {
  OPERATIONAL: "bg-orange-950 text-orange-300 ring-orange-700/50",
  OPEN: "bg-sky-950 text-sky-300 ring-sky-700/50",
  IN_PROGRESS: "bg-indigo-950 text-indigo-300 ring-indigo-700/50",
  ON_HOLD: "bg-amber-950 text-amber-300 ring-amber-700/50",
  COMPLETED: "bg-orange-950 text-orange-300 ring-orange-700/50",
  CANCELLED: "bg-slate-800 text-slate-300 ring-slate-600/50",
  CRITICAL: "bg-rose-950 text-rose-300 ring-rose-700/50",
  HIGH: "bg-orange-950 text-orange-300 ring-orange-700/50",
  MEDIUM: "bg-amber-950 text-amber-300 ring-amber-700/50",
  LOW: "bg-slate-800 text-slate-300 ring-slate-600/50",
  DEGRADED: "bg-amber-950 text-amber-300 ring-amber-700/50",
  OFFLINE: "bg-rose-950 text-rose-300 ring-rose-700/50",
  DECOMMISSIONED: "bg-slate-800 text-slate-300 ring-slate-600/50",
  PENDING: "bg-amber-950 text-amber-300 ring-amber-700/50",
  APPROVED: "bg-orange-950 text-orange-300 ring-orange-700/50",
  REJECTED: "bg-rose-950 text-rose-300 ring-rose-700/50",
};

export default function StatusBadge({ value }) {
  const tone = toneByValue[value] || "bg-slate-800 text-slate-300 ring-slate-600/50";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${tone}`}>
      {statusLabel(value)}
    </span>
  );
}
