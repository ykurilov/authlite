import { betterAuth, type BetterAuthOptions } from "better-auth";
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
  /**
   * Проверяет настройки, открывает базу, создаёт и обновляет таблицы.
   * Вызывается сама при первом запросе; вызовите при старте сервера, чтобы ошибки настройки
   * останавливали запуск сразу.
   */
  ready(): Promise<void>;
  /** Запасной выход к Better Auth для редких задач. Доступен после ready(). */
  readonly betterAuth: BetterAuthInstance;
  /** Итоговые настройки. Доступны после ready(). */
  readonly settings: Pick<AuthLiteSettings, "baseURL" | "routes" | "devEmailMode" | "appName">;
}

type BetterAuthInstance = ReturnType<typeof createBetterAuth>;

const DEV_MODE_WARNING =
  "[AuthLite] RESEND_API_KEY не задан — режим разработки: письма не отправляются, ссылки сброса пароля пишутся в журнал сервера.";

export function createAuthLite(options: AuthLiteOptions = {}): AuthLite {
  // Создание откладывается до ready(): импорт модуля при сборке приложения (next build)
  // не требует секретов и не трогает файл базы.
  let settings: AuthLiteSettings | undefined;
  let auth: BetterAuthInstance | undefined;
  let starting: Promise<void> | undefined;

  const ready = () => {
    starting ??= start().catch((error: unknown) => {
      starting = undefined;
      throw error;
    });
    return starting;
  };

  async function start() {
    const resolved = resolveSettings(options);
    const betterAuthOptions = buildBetterAuthOptions(resolved);
    // Таблицы создаются до запуска Better Auth, иначе он сообщает о несовпадении схемы.
    const { runMigrations } = await getMigrations(betterAuthOptions);
    await runMigrations();
    settings = resolved;
    auth = createBetterAuth(betterAuthOptions);
    if (resolved.devEmailMode) warnOncePerProcess(DEV_MODE_WARNING);
  }

  const started = () => {
    if (!auth || !settings) throw new Error("[AuthLite] Сначала дождитесь await authLite.ready()");
    return { auth, settings };
  };

  return {
    async handler(request) {
      await ready();
      return started().auth.handler(request);
    },
    async getCurrentUser(headers) {
      await ready();
      const result = await started().auth.api.getSession({ headers });
      if (!result) return null;
      const { id, email, name } = result.user;
      return { id, email, name: name || null };
    },
    ready,
    get betterAuth() {
      return started().auth;
    },
    get settings() {
      const { baseURL, routes, devEmailMode, appName } = started().settings;
      return { baseURL, routes, devEmailMode, appName };
    },
  };
}

function createBetterAuth(options: ReturnType<typeof buildBetterAuthOptions>) {
  return betterAuth(options);
}

function buildBetterAuthOptions(settings: AuthLiteSettings) {
  return {
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
  } satisfies BetterAuthOptions;
}

/** Next.js загружает модуль несколько раз (разные части приложения) — предупреждаем один раз. */
function warnOncePerProcess(message: string) {
  const store = globalThis as { __authliteWarnings?: Set<string> };
  store.__authliteWarnings ??= new Set();
  if (store.__authliteWarnings.has(message)) return;
  store.__authliteWarnings.add(message);
  console.warn(message);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
