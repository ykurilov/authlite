import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { getMigrations } from "better-auth/db/migration";
import { openDatabase } from "./database.js";
import { resolveSettings, type AuthLiteOptions, type AuthLiteSettings } from "./settings.js";

const DAY_IN_SECONDS = 24 * 60 * 60;

/** Пути Better Auth, в теле которых приходит email пользователя. */
const EMAIL_PATHS = new Set(["/sign-up/email", "/sign-in/email", "/request-password-reset"]);

export interface AuthLiteUser {
  id: string;
  email: string;
  name: string | null;
}

export interface AuthLite {
  /** Обработчик всех запросов /api/auth/*. */
  handler(request: Request): Promise<Response>;
  /** Текущий пользователь по заголовкам запроса (cookie) или null. */
  getCurrentUser(headers: Headers): Promise<AuthLiteUser | null>;
  /** Создаёт и обновляет таблицы. Вызывается автоматически при первом запросе. */
  ready(): Promise<void>;
  /** Запасной выход к Better Auth для редких задач. */
  betterAuth: ReturnType<typeof createBetterAuth>;
  settings: Pick<AuthLiteSettings, "baseURL" | "routes" | "devEmailMode" | "appName">;
}

export function createAuthLite(options: AuthLiteOptions = {}): AuthLite {
  const settings = resolveSettings(options);
  const auth = createBetterAuth(settings);

  if (settings.devEmailMode) {
    console.warn(
      "[AuthLite] RESEND_API_KEY не задан — режим разработки: письма не отправляются, ссылки сброса пароля пишутся в журнал сервера.",
    );
  }

  let migration: Promise<void> | undefined;
  const ready = () => {
    migration ??= getMigrations(auth.options)
      .then(({ runMigrations }) => runMigrations())
      .catch((error: unknown) => {
        migration = undefined;
        throw error;
      });
    return migration;
  };

  return {
    async handler(request) {
      await ready();
      return auth.handler(request);
    },
    async getCurrentUser(headers) {
      await ready();
      const result = await auth.api.getSession({ headers });
      if (!result) return null;
      const { id, email, name } = result.user;
      return { id, email, name: name || null };
    },
    ready,
    betterAuth: auth,
    settings: {
      baseURL: settings.baseURL,
      routes: settings.routes,
      devEmailMode: settings.devEmailMode,
      appName: settings.appName,
    },
  };
}

function createBetterAuth(settings: AuthLiteSettings) {
  return betterAuth({
    appName: settings.appName,
    secret: settings.secret,
    baseURL: settings.baseURL,
    basePath: "/api/auth",
    trustedOrigins: settings.trustedOrigins,
    database: openDatabase(settings.databasePath),
    telemetry: { enabled: false },
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    session: {
      expiresIn: 30 * DAY_IN_SECONDS,
      updateAge: DAY_IN_SECONDS,
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (!EMAIL_PATHS.has(ctx.path)) return;
        const email = (ctx.body as { email?: unknown } | undefined)?.email;
        if (typeof email !== "string") return;
        return { context: { body: { ...ctx.body, email: normalizeEmail(email) } } };
      }),
    },
  });
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
