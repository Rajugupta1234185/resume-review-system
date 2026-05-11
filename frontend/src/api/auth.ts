import { apiFetch } from "../lib/api";
import type { TokenResponse } from "../types/api";

export interface LoginPayload {
  email: string;
  password: string;
}

export function login(payload: LoginPayload) {
  return apiFetch<TokenResponse>("/auth/login", {
    method: "POST",
    body: payload,
    auth: false,
  });
}

export interface SignupPayload {
  full_name: string;
  email: string;
  password: string;
}

export function signup(payload: SignupPayload) {
  return apiFetch<TokenResponse>("/auth/signup", {
    method: "POST",
    body: { ...payload, role: "reviewer" },
    auth: false,
  });
}
