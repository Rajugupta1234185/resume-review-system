import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getToken, setToken, setUnauthorizedHandler } from "../lib/api";
import { decodeJwt, isExpired, toCurrentUser } from "../lib/jwt";
import type { CurrentUser, Role } from "../types/api";

interface AuthContextValue {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  isReady: boolean;
  login: (token: string) => void;
  logout: () => void;
  hasRole: (role: Role) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readUserFromToken(): CurrentUser | null {
  const token = getToken();
  if (!token) return null;
  const payload = decodeJwt(token);
  if (!payload || isExpired(payload)) {
    setToken(null);
    return null;
  }
  return toCurrentUser(payload);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setUser(readUserFromToken());
    setIsReady(true);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => logout());
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const login = useCallback((token: string) => {
    setToken(token);
    const payload = decodeJwt(token);
    if (!payload || isExpired(payload)) {
      setToken(null);
      setUser(null);
      throw new Error("Invalid or expired token");
    }
    setUser(toCurrentUser(payload));
  }, []);

  const hasRole = useCallback(
    (role: Role) => user?.role === role,
    [user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isReady,
      login,
      logout,
      hasRole,
    }),
    [user, isReady, login, logout, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
