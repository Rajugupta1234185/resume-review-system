import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listCandidates } from "../api/candidates";
import { useAuth } from "../context/AuthContext";
import type {
  ApiError,
  CandidateListResponse,
  CandidateStatus,
} from "../types/api";

const STATUS_OPTIONS: { value: "" | CandidateStatus; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "reviewed", label: "Reviewed" },
  { value: "hired", label: "Hired" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_BADGE: Record<CandidateStatus, string> = {
  new: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  reviewed: "bg-yellow-400/10 text-yellow-400 border-yellow-400/30",
  hired: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  rejected: "bg-red-500/10 text-red-300 border-red-500/30",
};

const PAGE_SIZE = 20;

export default function Candidates() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();

  const page = Math.max(1, Number(params.get("page") ?? "1"));
  const status = (params.get("status") ?? "") as CandidateStatus | "";
  const role_applied = params.get("role_applied") ?? "";
  const skill = params.get("skill") ?? "";
  const keyword = params.get("keyword") ?? "";

  // local form state — committed to URL on submit so back/forward and refresh work
  const [statusInput, setStatusInput] = useState(status);
  const [roleInput, setRoleInput] = useState(role_applied);
  const [skillInput, setSkillInput] = useState(skill);
  const [keywordInput, setKeywordInput] = useState(keyword);

  const [data, setData] = useState<CandidateListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setStatusInput(status);
    setRoleInput(role_applied);
    setSkillInput(skill);
    setKeywordInput(keyword);
  }, [status, role_applied, skill, keyword]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    listCandidates(
      {
        page,
        limit: PAGE_SIZE,
        status: status || undefined,
        role_applied: role_applied || undefined,
        skill: skill || undefined,
        keyword: keyword || undefined,
      },
      controller.signal
    )
      .then(setData)
      .catch((err: ApiError) => {
        if (controller.signal.aborted) return;
        setError(err.message ?? "Failed to load candidates");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [page, status, role_applied, skill, keyword]);

  const visibleCandidates = useMemo(() => {
    if (!data) return [];
    // Backend doesn't yet implement filters — fall back to client-side filtering
    // of the current page so the UI behaves correctly. Once the backend honors
    // the query params, this becomes a no-op.
    let items = data.data;
    if (status) items = items.filter((c) => c.status === status);
    if (skill) {
      const s = skill.toLowerCase();
      items = items.filter((c) =>
        c.skills.some((k) => k.toLowerCase().includes(s))
      );
    }
    if (keyword) {
      const k = keyword.toLowerCase();
      items = items.filter(
        (c) =>
          c.name.toLowerCase().includes(k) ||
          c.email.toLowerCase().includes(k)
      );
    }
    return items;
  }, [data, status, skill, keyword]);

  const applyFilters = () => {
    const next = new URLSearchParams();
    next.set("page", "1");
    if (statusInput) next.set("status", statusInput);
    if (roleInput) next.set("role_applied", roleInput);
    if (skillInput) next.set("skill", skillInput);
    if (keywordInput) next.set("keyword", keywordInput);
    setParams(next);
  };

  const clearFilters = () => setParams(new URLSearchParams({ page: "1" }));

  const goToPage = (next: number) => {
    const sp = new URLSearchParams(params);
    sp.set("page", String(next));
    setParams(sp);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Candidates</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {user?.role === "admin"
              ? "All candidates and scores across the team."
              : "Candidates available for review."}
          </p>
        </div>
      </div>

      {/* Filters */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters();
        }}
        className="grid grid-cols-1 gap-3 rounded-lg border border-neutral-900 bg-neutral-950/50 p-4 md:grid-cols-5"
      >
        <input
          type="text"
          placeholder="Search name or email"
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
          className="md:col-span-2 rounded-md border border-neutral-800 bg-black px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-yellow-400 focus:outline-none"
        />
        <select
          value={statusInput}
          onChange={(e) =>
            setStatusInput(e.target.value as CandidateStatus | "")
          }
          className="rounded-md border border-neutral-800 bg-black px-3 py-2 text-sm text-white focus:border-yellow-400 focus:outline-none"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Skill"
          value={skillInput}
          onChange={(e) => setSkillInput(e.target.value)}
          className="rounded-md border border-neutral-800 bg-black px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-yellow-400 focus:outline-none"
        />
        <input
          type="text"
          placeholder="Role applied"
          value={roleInput}
          onChange={(e) => setRoleInput(e.target.value)}
          className="rounded-md border border-neutral-800 bg-black px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-yellow-400 focus:outline-none"
        />

        <div className="flex gap-2 md:col-span-5">
          <button
            type="submit"
            className="rounded-md bg-yellow-400 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-300"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-md border border-neutral-800 px-4 py-2 text-sm text-neutral-300 hover:border-yellow-400 hover:text-yellow-400"
          >
            Clear
          </button>
        </div>
      </form>

      {/* List */}
      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-md border border-neutral-900 bg-neutral-950/50 p-8 text-center text-sm text-neutral-500">
          Loading candidates…
        </div>
      ) : visibleCandidates.length === 0 ? (
        <div className="rounded-md border border-neutral-900 bg-neutral-950/50 p-8 text-center text-sm text-neutral-500">
          No candidates match the current filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-900">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-950 text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Skills</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {visibleCandidates.map((c) => (
                <tr key={c.id} className="bg-black hover:bg-neutral-950">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{c.name}</div>
                    <div className="text-xs text-neutral-500">{c.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded border px-2 py-0.5 text-xs ${STATUS_BADGE[c.status]}`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.skills.slice(0, 4).map((s) => (
                        <span
                          key={s}
                          className="rounded bg-neutral-900 px-2 py-0.5 text-xs text-neutral-300"
                        >
                          {s}
                        </span>
                      ))}
                      {c.skills.length > 4 && (
                        <span className="text-xs text-neutral-500">
                          +{c.skills.length - 4}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/candidates/${c.id}`}
                      className="text-xs font-medium text-yellow-400 hover:underline"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && data.pagination.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm text-neutral-400">
          <div>
            Page {data.pagination.page} of {data.pagination.total_pages} ·{" "}
            {data.pagination.total} total
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!data.pagination.has_prev}
              onClick={() => goToPage(page - 1)}
              className="rounded-md border border-neutral-800 px-3 py-1.5 text-xs hover:border-yellow-400 hover:text-yellow-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-neutral-800 disabled:hover:text-neutral-400"
            >
              ← Prev
            </button>
            <button
              type="button"
              disabled={!data.pagination.has_next}
              onClick={() => goToPage(page + 1)}
              className="rounded-md border border-neutral-800 px-3 py-1.5 text-xs hover:border-yellow-400 hover:text-yellow-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-neutral-800 disabled:hover:text-neutral-400"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
