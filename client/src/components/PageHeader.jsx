import { Link } from "react-router-dom";
import StatusBadge from "../components/StatusBadge.jsx";

export default function PageHeader({ title, description, action }) {
  return (
    <div className="flow-card mb-6 flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
        {description ? <p className="mt-2 max-w-2xl leading-relaxed text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function RecordLink({ to, title, subtitle, badge }) {
  return (
    <Link
      to={to}
      className="flow-card block p-4 transition-transform duration-300 hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{title}</p>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {badge ? <StatusBadge value={badge} /> : null}
      </div>
    </Link>
  );
}

export function EmptyState({ message }) {
  return (
    <p className="rounded-2xl border border-dashed border-slate-400/60 bg-slate-200/80 p-8 text-center text-slate-600 backdrop-blur-sm">
      {message}
    </p>
  );
}
