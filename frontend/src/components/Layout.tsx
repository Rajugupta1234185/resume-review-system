import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-neutral-900 bg-black/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/candidates" className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded bg-yellow-400 text-sm font-bold text-black">
              TS
            </span>
            <span className="text-lg font-semibold tracking-tight">
              TalentScoreHub
            </span>
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            <NavLink
              to="/candidates"
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm transition ${
                  isActive
                    ? "bg-neutral-900 text-yellow-400"
                    : "text-neutral-300 hover:text-white"
                }`
              }
            >
              Candidates
            </NavLink>
          </nav>

          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden text-right text-xs leading-tight sm:block">
                <div className="text-white">{user.full_name}</div>
                <div className="text-neutral-500">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                      user.role === "admin"
                        ? "bg-yellow-400/15 text-yellow-400"
                        : "bg-neutral-800 text-neutral-300"
                    }`}
                  >
                    {user.role}
                  </span>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-neutral-800 px-3 py-1.5 text-sm text-neutral-300 transition hover:border-yellow-400 hover:text-yellow-400"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
