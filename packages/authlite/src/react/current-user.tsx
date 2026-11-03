"use client";
import { useEffect, useState, type ReactNode } from "react";
import { authApi } from "./auth-api.js";

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
}

/** Текущий пользователь в браузере. Для решений о доступе на сервере — getCurrentUser переходника. */
export function useCurrentUser(): { user: CurrentUser | null; loading: boolean } {
  const [state, setState] = useState<{ user: CurrentUser | null; loading: boolean }>({ user: null, loading: true });
  useEffect(() => {
    let cancelled = false;
    authApi
      .getSession()
      .catch(() => null)
      .then((session) => {
        if (cancelled) return;
        const user = session?.user ? { id: session.user.id, email: session.user.email, name: session.user.name || null } : null;
        setState({ user, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

export interface AuthGuardProps {
  loginHref?: string;
  /** Что показать, пока проверяется вход. */
  fallback?: ReactNode;
  children: ReactNode | ((user: CurrentUser) => ReactNode);
}

/** Защита страницы в одностраничном приложении: без входа — переход на вход с возвратом. */
export function AuthGuard({ loginHref = "/login", fallback = null, children }: AuthGuardProps) {
  const { user, loading } = useCurrentUser();
  useEffect(() => {
    if (loading || user) return;
    const returnTo = window.location.pathname + window.location.search;
    window.location.replace(`${loginHref}?next=${encodeURIComponent(returnTo)}`);
  }, [loading, user, loginHref]);
  if (!user) return <>{fallback}</>;
  return <>{typeof children === "function" ? children(user) : children}</>;
}
