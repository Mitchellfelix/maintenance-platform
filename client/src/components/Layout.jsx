import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const navItems = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/sites", label: "Sites" },
  { to: "/assets", label: "Assets" },
  { to: "/workorders", label: "Work Orders" },
  { to: "/admin/users", label: "User access", permission: "users:read" },
  { to: "/admin/audit", label: "Audit log", permission: "audit:read" },
];

function navClassName({ isActive }) {
  return [
    "rounded-xl px-3 py-2 text-sm font-medium transition",
    isActive ? "bg-emerald-500 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white",
  ].join(" ");
}

export default function Layout() {
  const { user, logout, isAuthenticated, can, roleLabel } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row lg:px-6">
        <aside className="flex shrink-0 flex-col gap-6 rounded-3xl bg-slate-950 p-6 text-white shadow-lg lg:w-64">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-300">
              Maintenance Platform
            </p>
            <h1 className="mt-2 text-2xl font-bold">Operations</h1>
          </div>

          <nav className="flex flex-col gap-1">
            {navItems
              .filter((item) => !item.permission || can(item.permission))
              .map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClassName}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl bg-white/5 p-4">
            {isAuthenticated ? (
              <>
                <p className="text-sm font-medium">{user?.name || user?.email}</p>
                <p className="mt-1 text-xs text-slate-400">{roleLabel}</p>
                <button
                  type="button"
                  onClick={logout}
                  className="mt-4 w-full rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/10"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-300">Sign in to create and edit records.</p>
                <NavLink
                  to="/login"
                  className="mt-4 inline-flex w-full justify-center rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-white"
                >
                  Sign in
                </NavLink>
              </>
            )}
          </div>
        </aside>

        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
