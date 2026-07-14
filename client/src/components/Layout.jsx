import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const navItems = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/sites", label: "Sites" },
  { to: "/assets", label: "Assets" },
  { to: "/workorders", label: "Work Orders" },
  { to: "/inventory", label: "Inventory" },
  { to: "/sops", label: "Department SOPs" },
  { to: "/access/request", label: "Request access" },
  { to: "/admin/users", label: "User access", permission: "users:read" },
  { to: "/admin/access-requests", label: "Access requests", permission: "access-requests:read" },
  { to: "/admin/audit", label: "Audit log", permission: "audit:read" },
];

function navClassName({ isActive }) {
  return [
    "rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300 ease-out",
    isActive
      ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/30"
      : "text-slate-300 hover:translate-x-0.5 hover:bg-white/10 hover:text-white",
  ].join(" ");
}

export default function Layout() {
  const { user, logout, can, roleLabel } = useAuth();

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="flow-orb -left-20 top-0 h-96 w-96 bg-orange-500/20" />
      <div className="flow-orb right-0 top-1/4 h-80 w-80 bg-sky-500/15 [animation-delay:-4s]" />
      <div className="flow-orb bottom-0 left-1/3 h-72 w-72 bg-amber-500/15 [animation-delay:-8s]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row lg:px-6">
        <aside className="flex shrink-0 flex-col gap-6 rounded-[2rem] border border-white/10 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-6 text-white shadow-2xl shadow-slate-900/25 lg:w-64">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-orange-300/90">
              EMAT Tracking Database
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">Navy Sustainment</h1>
          </div>

          <nav className="flex flex-col gap-1.5">
            {navItems
              .filter((item) => !item.permission || can(item.permission))
              .map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={navClassName}>
                  {item.label}
                </NavLink>
              ))}
          </nav>

          <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <p className="text-sm font-medium">{user?.name || user?.email}</p>
            <p className="mt-1 text-xs text-slate-400">{roleLabel}</p>
            <button
              type="button"
              onClick={logout}
              className="mt-4 w-full rounded-xl border border-white/10 px-3 py-2 text-sm transition-all duration-300 hover:bg-white/10"
            >
              Sign out
            </button>
          </div>
        </aside>

        <main className="flow-page flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
