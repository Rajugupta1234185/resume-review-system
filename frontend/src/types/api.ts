export type Role = "admin" | "reviewer";

export type CandidateStatus = "new" | "reviewed" | "hired" | "rejected";

export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
}

export interface JwtPayload {
  user_id: number;
  full_name: string;
  role: Role;
  exp: number;
}

export interface CurrentUser {
  user_id: number;
  full_name: string;
  role: Role;
}

export interface Candidate {
  id: number;
  name: string;
  email: string;
  status: CandidateStatus;
  skills: string[];
  internal_notes: string | null;
  created_at: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface CandidateListResponse {
  data: Candidate[];
  pagination: Pagination;
}

export interface Score {
  id: number;
  candidate_id: number;
  category: string;
  score: number;
  reviewer_id: number;
  note: string | null;
  created_at: string;
}

export interface CandidateSummary {
  candidate_id: number;
  summary: string;
  generated_at: string;
}

export interface CandidateListFilters {
  page: number;
  limit: number;
  status?: CandidateStatus;
  role_applied?: string;
  skill?: string;
  keyword?: string;
}

export interface ApiError {
  status: number;
  message: string;
  detail?: unknown;
}
