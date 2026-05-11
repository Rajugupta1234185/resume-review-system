import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { login as loginRequest } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import type { ApiError } from "../types/api";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, isAuthenticated, isReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo =
    (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname ?? "/candidates";

  useEffect(() => {
    console.log("inside login Page");
  }, []);

  if (isReady && isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const submit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const { access_token } = await loginRequest({ email, password });
      login(access_token);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message ?? "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-black text-white">
      {/* LEFT — decorative grid pattern on black, yellow glow accent */}
      <div
        className="relative hidden flex-1 items-center justify-center overflow-hidden bg-black lg:flex"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(250,204,21,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(250,204,21,0.08) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.18)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,black_95%)]" />

        <div className="relative z-10 px-12 text-center">
          <span className="inline-block rounded-full border border-yellow-400/40 bg-yellow-400/10 px-3 py-1 text-xs font-medium uppercase tracking-widest text-yellow-400">
            Candidate Review System
          </span>

          <h1 className="mt-6 text-5xl font-semibold tracking-tight text-white">
            Hire <span className="text-yellow-400">smarter</span>,
            <br />
            move faster.
          </h1>
          <p className="mt-4 text-lg text-neutral-400">
            AI-powered scoring for every candidate.
          </p>
        </div>
      </div>

      {/* RIGHT — login form on black */}
      <div className="flex flex-1 items-center justify-center bg-black px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="w-full max-w-sm space-y-6"
        >
          <div>
            <h2 className="text-3xl font-semibold text-white">
              Welcome <span className="text-yellow-400">back</span>
            </h2>
            <p className="mt-2 text-sm text-neutral-400">
              Sign in to your account to continue.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
            >
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-neutral-300"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 disabled:opacity-60"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-neutral-300"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 disabled:opacity-60"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-yellow-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-center text-xs text-neutral-500">
            Reviewer demo: <span className="text-neutral-300">reviewer1@talenthub.local</span> /{" "}
            <span className="text-neutral-300">Reviewer@123</span>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;
