import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthLite, AuthLiteUser } from "../core/create-auth-lite.js";
import { loginRedirectPath, unauthorizedResponse } from "../core/protection.js";

export type { AuthLiteUser };

export interface NextAuth {
  /**
   * Проверка при старте сервера — вызывайте в instrumentation.ts. Ошибка настройки
   * (нет секрета, база недоступна для записи) печатается и останавливает процесс.
   */
  startup(): Promise<void>;
  /** Для app/api/auth/[...all]/route.ts: export const { GET, POST } = nextAuth.handlers */
  handlers: { GET(request: Request): Promise<Response>; POST(request: Request): Promise<Response> };
  /** Текущий пользователь в серверном компоненте, действии или обработчике. */
  getCurrentUser(): Promise<AuthLiteUser | null>;
  /** Защита страницы: без входа — перенаправление на вход с возвратом на returnTo. */
  requireUser(returnTo: string): Promise<AuthLiteUser>;
  /** Защита обработчика запроса данных: без входа — 401 {"error":"unauthorized"}. */
  withUser<Context = unknown>(
    handler: (request: Request, user: AuthLiteUser, context: Context | undefined) => Response | Promise<Response>,
  ): (request: Request, context?: Context) => Promise<Response>;
}

export function createNextAuth(authLite: AuthLite): NextAuth {
  const handle = (request: Request) => authLite.handler(request);
  const getCurrentUser = async () => authLite.getCurrentUser(await headers());

  return {
    async startup() {
      try {
        await authLite.ready();
      } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
      }
    },
    handlers: { GET: handle, POST: handle },
    getCurrentUser,
    async requireUser(returnTo) {
      const user = await getCurrentUser();
      if (!user) return redirect(loginRedirectPath(authLite.settings.routes.login, returnTo));
      return user;
    },
    withUser(handler) {
      return async (request, context) => {
        const user = await authLite.getCurrentUser(request.headers);
        if (!user) return unauthorizedResponse();
        return handler(request, user, context);
      };
    },
  };
}
