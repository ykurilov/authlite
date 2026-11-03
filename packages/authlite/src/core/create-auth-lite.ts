import { betterAuth, type BetterAuthOptions } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { getMigrations } from "better-auth/db/migration";
import { openDatabase } from "./database.js";
import { createConsoleSender } from "./email/console-sender.js";
import type { EmailSender } from "./email/email-sender.js";
import { createResendSender } from "./email/resend-sender.js";
import { buildResetPasswordEmail } from "./email/reset-password-email.js";
import { revokeOlderResetLinks } from "./reset-links.js";
import { createResetRequestLimiter } from "./reset-request-limiter.js";
import { resolveSettings, type AuthLiteOptions, type AuthLiteSettings } from "./settings.js";

const DAY_IN_SECONDS = 24 * 60 * 60;
const RESET_LINK_LIFETIME_SECONDS = 60 * 60;
const RESET_REQUESTS_PER_EMAIL = { max: 3, windowMs: 10 * 60 * 1000 };
/** Ответ Better Auth на запрос сброса: одинаковый для любых адресов. */
const NEUTRAL_RESET_RESPONSE = {
  status: true,
  message: "If this email exists in our system, check your email for the reset link",
};

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
  const database = openDatabase(settings.databasePath);
  const emailSender = createEmailSender(settings);
  const resetRequestsPerEmail = createResetRequestLimiter(RESET_REQUESTS_PER_EMAIL);
  return {
    appName: settings.appName,
    secret: settings.secret,
    baseURL: settings.baseURL,
    basePath: "/api/auth",
    trustedOrigins: settings.trustedOrigins,
    database,
    telemetry: { enabled: false },
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: RESET_LINK_LIFETIME_SECONDS,
      revokeSessionsOnPasswordReset: true,
      async sendResetPassword({ user, url, token }) {
        revokeOlderResetLinks(database, user.id, token);
        // Письмо уходит в фоне: ответ не ждёт почтовый сервис, не зависит от его сбоев
        // и по времени не выдаёт, зарегистрирован ли адрес.
        const message = buildResetPasswordEmail({ appName: settings.appName, to: user.email, url });
        void emailSender.send(message).catch((error: unknown) => {
          const reason = error instanceof Error ? error.message : String(error);
          console.error(`[AuthLite] Не удалось отправить письмо сброса пароля на ${user.email}: ${reason}`);
        });
      },
    },
    session: {
      expiresIn: 30 * DAY_IN_SECONDS,
      updateAge: DAY_IN_SECONDS,
    },
    // Ограничение по адресу подключения (берётся из X-Forwarded-For, его задаёт nginx).
    // Включено всегда, а не только в рабочем режиме, как по умолчанию в Better Auth.
    rateLimit: {
      enabled: true,
      storage: "memory",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 10 * 60, max: 3 },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (!EMAIL_PATHS.has(ctx.path)) return;
        const body = (ctx.body ?? {}) as { email?: unknown; redirectTo?: unknown };
        if (typeof body.email !== "string") return;
        const normalized: Record<string, unknown> = { ...body, email: normalizeEmail(body.email) };
        // Без адреса возврата ссылка из письма вела бы в никуда — ведём на экран нового пароля.
        if (ctx.path === "/request-password-reset") {
          if (!body.redirectTo) normalized.redirectTo = settings.routes.resetPassword;
          // Лимит на сам ящик: письмо не уходит, а ответ тот же, чтобы не выдать, что адрес есть.
          if (!resetRequestsPerEmail.tryAcquire(normalized.email as string)) return ctx.json(NEUTRAL_RESET_RESPONSE);
        }
        return { context: { body: normalized } };
      }),
    },
  } satisfies BetterAuthOptions;
}

function createEmailSender(settings: AuthLiteSettings): EmailSender {
  switch (settings.email.kind) {
    case "custom":
      return settings.email.sender;
    case "resend":
      return createResendSender({ apiKey: settings.email.apiKey, from: settings.email.from });
    case "console":
      return createConsoleSender();
  }
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
