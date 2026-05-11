import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  generateSummary,
  getCandidate,
  submitScore,
} from "../api/candidates";
import { useAuth } from "../context/AuthContext";
import type {
  ApiError,
  Candidate,
  CandidateStatus,
  CandidateSummary,
  Score,
} from "../types/api";

const STATUS_BADGE: Record<CandidateStatus, string> = {
  new: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  reviewed: "bg-yellow-400/10 text-yellow-400 border-yellow-400/30",
  hired: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  rejected: "bg-red-500/10 text-red-300 border-red-500/30",
};

const SCORE_CATEGORIES = [
  "Technical",
  "Communication",
  "Culture Fit",
  "Problem Solving",
  "Experience",
];

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const candidateId = Number(id);
  const { user, hasRole } = useAuth();

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // scores submitted within this session (the backend has no plain HTTP list endpoint;
  // historical scores arrive via the SSE /stream which is a stretch goal).
  const [recentScores, setRecentScores] = useState<Score[]>([]);

  // score form
  const [category, setCategory] = useState(SCORE_CATEGORIES[0]);
  const [scoreValue, setScoreValue] = useState(3);
  const [note, setNote] = useState("");
  const [isSubmittingScore, setIsSubmittingScore] = useState(false);
  const [scoreFormError, setScoreFormError] = useState<string | null>(null);

  // AI summary
  const [summary, setSummary] = useState<CandidateSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(candidateId)) return;
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);
    getCandidate(candidateId, controller.signal)
      .then(setCandidate)
      .catch((err: ApiError) => {
        if (controller.signal.aborted) return;
        setLoadError(err.message ?? "Failed to load candidate");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [candidateId]);

  const handleScoreSubmit = async () => {
    setScoreFormError(null);
    setIsSubmittingScore(true);
    try {
      const created = await submitScore(candidateId, {
        category,
        score: scoreValue,
        note: note || undefined,
      });
      setRecentScores((prev) => [created, ...prev]);
      setNote("");
    } catch (err) {
      const apiErr = err as ApiError;
      setScoreFormError(apiErr.message ?? "Failed to submit score");
    } finally {
      setIsSubmittingScore(false);
    }
  };

  const handleGenerateSummary = async () => {
    setSummaryError(null);
    setIsSummaryLoading(true);
    try {
      const result = await generateSummary(candidateId);
      setSummary(result);
    } catch (err) {
      const apiErr = err as ApiError;
      setSummaryError(apiErr.message ?? "Failed to generate summary");
    } finally {
      setIsSummaryLoading(false);
    }
  };

  // Reviewers see only their own scores; admins see all.
  const visibleScores = hasRole("admin")
    ? recentScores
    : recentScores.filter((s) => s.reviewer_id === user?.user_id);

  if (isLoading) {
    return (
      <div className="rounded-md border border-neutral-900 bg-neutral-950/50 p-8 text-center text-sm text-neutral-500">
        Loading candidate…
      </div>
    );
  }

  if (loadError || !candidate) {
    return (
      <div className="space-y-4">
        <Link
          to="/candidates"
          className="text-xs text-neutral-400 hover:text-yellow-400"
        >
          ← Back to candidates
        </Link>
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {loadError ?? "Candidate not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/candidates"
        className="inline-block text-xs text-neutral-400 hover:text-yellow-400"
      >
        ← Back to candidates
      </Link>

      {/* Profile header */}
      <header className="rounded-lg border border-neutral-900 bg-neutral-950/50 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">
              {candidate.name}
            </h1>
            <p className="mt-1 text-sm text-neutral-400">{candidate.email}</p>
            <div className="mt-3 flex items-center gap-2">
              <span
                className={`inline-block rounded border px-2 py-0.5 text-xs ${STATUS_BADGE[candidate.status]}`}
              >
                {candidate.status}
              </span>
              <span className="text-xs text-neutral-500">
                Added {new Date(candidate.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        {candidate.skills.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1">
            {candidate.skills.map((s) => (
              <span
                key={s}
                className="rounded bg-neutral-900 px-2 py-0.5 text-xs text-neutral-300"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: scoring + history */}
        <div className="space-y-6 lg:col-span-2">
          {/* Score form */}
          <section className="rounded-lg border border-neutral-900 bg-neutral-950/50 p-6">
            <h2 className="text-lg font-semibold text-white">Submit a score</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Rate this candidate on a category (0–5).
            </p>

            {scoreFormError && (
              <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {scoreFormError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleScoreSubmit();
              }}
              className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"
            >
              <div>
                <label className="mb-1 block text-xs text-neutral-400">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-md border border-neutral-800 bg-black px-3 py-2 text-sm text-white focus:border-yellow-400 focus:outline-none"
                >
                  {SCORE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-neutral-400">
                  Score: <span className="text-yellow-400">{scoreValue}</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={1}
                  value={scoreValue}
                  onChange={(e) => setScoreValue(Number(e.target.value))}
                  className="w-full accent-yellow-400"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-neutral-400">
                  Note (optional, max 20 chars)
                </label>
                <input
                  type="text"
                  maxLength={20}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Strong on system design"
                  className="w-full rounded-md border border-neutral-800 bg-black px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-yellow-400 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={isSubmittingScore}
                  className="rounded-md bg-yellow-400 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingScore ? "Submitting…" : "Submit score"}
                </button>
              </div>
            </form>
          </section>

          {/* Recent scores */}
          <section className="rounded-lg border border-neutral-900 bg-neutral-950/50 p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-white">
                {hasRole("admin") ? "All scores (this session)" : "Your scores (this session)"}
              </h2>
              <span className="text-xs text-neutral-500">
                Historical scores stream via SSE — stretch goal.
              </span>
            </div>

            {visibleScores.length === 0 ? (
              <p className="mt-4 text-sm text-neutral-500">
                No scores submitted yet.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-neutral-900">
                {visibleScores.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <div className="text-sm font-medium text-white">
                        {s.category}
                      </div>
                      {s.note && (
                        <div className="text-xs text-neutral-500">{s.note}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {hasRole("admin") && (
                        <span className="text-xs text-neutral-500">
                          reviewer #{s.reviewer_id}
                        </span>
                      )}
                      <span className="rounded bg-yellow-400/10 px-2 py-1 text-sm font-semibold text-yellow-400">
                        {s.score} / 5
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Right: AI summary + admin notes */}
        <div className="space-y-6">
          <section className="rounded-lg border border-neutral-900 bg-neutral-950/50 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">AI Summary</h2>
              <span className="text-xs text-neutral-500">~2s</span>
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              Generates a profile summary from the candidate and scores.
            </p>

            <button
              type="button"
              onClick={handleGenerateSummary}
              disabled={isSummaryLoading}
              className="mt-4 w-full rounded-md border border-yellow-400/40 bg-yellow-400/10 px-3 py-2 text-sm font-medium text-yellow-400 transition hover:bg-yellow-400/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSummaryLoading
                ? "Generating…"
                : summary
                  ? "Regenerate summary"
                  : "Generate summary"}
            </button>

            {summaryError && (
              <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {summaryError}
              </div>
            )}

            {isSummaryLoading && !summary && (
              <div className="mt-4 space-y-2">
                <div className="h-3 animate-pulse rounded bg-neutral-900" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-neutral-900" />
                <div className="h-3 w-4/6 animate-pulse rounded bg-neutral-900" />
              </div>
            )}

            {summary && !isSummaryLoading && (
              <div className="mt-4 space-y-2">
                <p className="whitespace-pre-line text-sm text-neutral-200">
                  {summary.summary}
                </p>
                <p className="text-xs text-neutral-500">
                  Generated {new Date(summary.generated_at).toLocaleString()}
                </p>
              </div>
            )}
          </section>

          {hasRole("admin") && (
            <section className="rounded-lg border border-yellow-400/40 bg-yellow-400/5 p-6">
              <div className="flex items-center gap-2">
                <span className="rounded bg-yellow-400/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-yellow-400">
                  Admin only
                </span>
              </div>
              <h2 className="mt-3 text-lg font-semibold text-white">
                Internal notes
              </h2>
              <p className="mt-3 whitespace-pre-line text-sm text-neutral-200">
                {candidate.internal_notes?.trim() ? (
                  candidate.internal_notes
                ) : (
                  <span className="text-neutral-500">No internal notes recorded.</span>
                )}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
