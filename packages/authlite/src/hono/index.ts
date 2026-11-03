import type { Context, Hono, MiddlewareHandler } from "hono";
import type { AuthLite, AuthLiteUser } from "../core/create-auth-lite.js";
import { loginRedirectPath, unauthorizedResponse } from "../core/protection.js";

export type { AuthLiteUser };

/** Переменные контекста Hono: c.get("user") после requireUser/requirePage. */
export type AuthLiteVariables = { user: AuthLiteUser };

/** Подключает обработчик AuthLite на /api/auth/*. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mountAuthLite(app: Hono<any>, authLite: AuthLite): void {
  app.on(["GET", "POST"], "/api/auth/*", (c) => authLite.handler(c.req.raw));
}

export function getCurrentUser(authLite: AuthLite, c: Context): Promise<AuthLiteUser | null> {
  return authLite.getCurrentUser(c.req.raw.headers);
}

/** Защита запроса данных: без входа — 401 {"error":"unauthorized"}. */
export function requireUser(authLite: AuthLite): MiddlewareHandler<{ Variables: AuthLiteVariables }> {
  return async (c, next) => {
    const user = await getCurrentUser(authLite, c);
    if (!user) return unauthorizedResponse();
    c.set("user", user);
    await next();
  };
}

/** Защита страницы: без входа — перенаправление на вход с возвратом. */
export function requirePage(authLite: AuthLite): MiddlewareHandler<{ Variables: AuthLiteVariables }> {
  return async (c, next) => {
    const user = await getCurrentUser(authLite, c);
    if (!user) {
      const url = new URL(c.req.url);
      return c.redirect(loginRedirectPath(authLite.settings.routes.login, url.pathname + url.search), 302);
    }
    c.set("user", user);
    await next();
  };
}
