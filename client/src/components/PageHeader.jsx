import { Link } from "react-router-dom";
import StatusBadge from "../components/StatusBadge.jsx";

export default function PageHeader({ title, description, action }) {
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
        {description ? <p className="mt-2 max-w-2xl text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function RecordLink({ to, title, subtitle, badge }) {
  return (
    <Link
      to={to}
      className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
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
  return <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500">{message}</p>;
}
