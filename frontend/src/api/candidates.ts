import { apiFetch } from "../lib/api";
import type {
  Candidate,
  CandidateListFilters,
  CandidateListResponse,
  CandidateSummary,
  Score,
} from "../types/api";

export function listCandidates(filters: CandidateListFilters, signal?: AbortSignal) {
  return apiFetch<CandidateListResponse>("/candidates", {
    query: {
      page: filters.page,
      limit: filters.limit,
      status: filters.status,
      role_applied: filters.role_applied,
      skill: filters.skill,
      keyword: filters.keyword,
    },
    signal,
  });
}

export function getCandidate(id: number, signal?: AbortSignal) {
  return apiFetch<Candidate>(`/candidates/${id}`, { signal });
}

export interface CreateScoreInput {
  category: string;
  score: number;
  note?: string;
}

export function submitScore(candidateId: number, input: CreateScoreInput) {
  return apiFetch<Score>(`/candidates/${candidateId}/scores`, {
    method: "POST",
    body: input,
  });
}

export function generateSummary(candidateId: number, signal?: AbortSignal) {
  return apiFetch<CandidateSummary>(`/candidates/${candidateId}/summary`, {
    method: "POST",
    signal,
  });
}
