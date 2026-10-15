"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError, getCurrentUser, logout, type AuthUser } from "@/src/lib/api";

type AuthContextValue = {
  user: AuthUser | null;
  ready: boolean;
  refresh: () => Promise<AuthUser | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const publicPaths = new Set(["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"]);

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const current = await getCurrentUser();
      setUser(current);
      return current;
    } catch (error) {
      setUser(null);
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((current) => { if (active) setUser(current); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const isPublic = publicPaths.has(pathname);
    if (!user && !isPublic) router.replace("/login");
    if (user && isPublic) router.replace("/");
  }, [pathname, ready, router, user]);

  useEffect(() => {
    if (!ready || !user) return;
    const requiredPermission = pathname === "/admin/users" ? "USER_READ"
      : pathname === "/admin/roles" ? "ROLE_READ"
      : pathname === "/admin/audit" ? "AUDIT_READ"
      : null;
    if (requiredPermission && !user.permissions?.includes(requiredPermission)) router.replace("/");
  }, [pathname, ready, router, user]);

  const signOut = useCallback(async () => {
    await logout();
    setUser(null);
    router.replace("/login");
  }, [router]);

  const value = useMemo(() => ({ user, ready, refresh, signOut }), [user, ready, refresh, signOut]);
  const isPublic = publicPaths.has(pathname);
  const awaitingProtectedRoute = !ready && !isPublic;
  const requiredPermission = pathname === "/admin/users" ? "USER_READ"
    : pathname === "/admin/roles" ? "ROLE_READ"
    : pathname === "/admin/audit" ? "AUDIT_READ"
    : null;
  const forbidden = Boolean(user && requiredPermission && !user.permissions?.includes(requiredPermission));
  const redirecting = ready && ((user && isPublic) || (!user && !isPublic) || forbidden);

  return <AuthContext.Provider value={value}>
    {awaitingProtectedRoute || redirecting ? <div className="auth-loading" role="status">Cargando CDCI…</div> : children}
  </AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider.");
  return context;
}
