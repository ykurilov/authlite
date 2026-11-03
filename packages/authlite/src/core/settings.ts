import { resolve } from "node:path";
import type { EmailSender } from "./email/email-sender.js";
import { AuthLiteConfigError } from "./errors.js";

export interface AuthLiteOptions {
  /** Секрет сессий. По умолчанию — AUTHLITE_SECRET. Не короче 32 символов. */
  secret?: string;
  /** Адрес приложения, например https://app.example.com. По умолчанию — AUTHLITE_URL. */
  baseURL?: string;
  /** Путь к файлу SQLite. По умолчанию — AUTHLITE_DB_PATH или ./data/authlite.sqlite. */
  databasePath?: string;
  /** Название приложения для писем. По умолчанию — AUTHLITE_APP_NAME или «Приложение». */
  appName?: string;
  email?: {
    /** Свой почтовый провайдер. Иначе Resend (при RESEND_API_KEY) или режим разработки. */
    sender?: EmailSender;
    /** Отправитель писем Resend. По умолчанию — AUTHLITE_EMAIL_FROM. */
    from?: string;
  };
  /** Адреса экранов в приложении. */
  routes?: { login?: string; resetPassword?: string };
  /** Дополнительные доверенные адреса (например, адрес dev-сервера Vite). */
  trustedOrigins?: string[];
}

export interface AuthLiteSettings {
  secret: string;
  baseURL: string;
  databasePath: string;
  appName: string;
  routes: { login: string; resetPassword: string };
  trustedOrigins: string[];
  email:
    | { kind: "custom"; sender: EmailSender }
    | { kind: "resend"; apiKey: string; from: string }
    | { kind: "console" };
  devEmailMode: boolean;
}

type Env = Record<string, string | undefined>;

const MIN_SECRET_LENGTH = 32;

export function resolveSettings(options: AuthLiteOptions = {}, env: Env = process.env): AuthLiteSettings {
  const secret = options.secret ?? env.AUTHLITE_SECRET;
  if (!secret) {
    throw new AuthLiteConfigError(
      "Не задан секрет сессий. Задайте переменную окружения AUTHLITE_SECRET — случайную строку " +
        "не короче 32 символов. Сгенерировать: openssl rand -base64 32",
    );
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new AuthLiteConfigError(
      `AUTHLITE_SECRET слишком короткий: нужно не меньше ${MIN_SECRET_LENGTH} символов. ` +
        "Сгенерировать: openssl rand -base64 32",
    );
  }

  const baseURL = parseBaseURL(options.baseURL ?? env.AUTHLITE_URL);

  const email = resolveEmail(options, env);

  return {
    secret,
    baseURL,
    databasePath: resolve(options.databasePath ?? env.AUTHLITE_DB_PATH ?? "./data/authlite.sqlite"),
    appName: options.appName ?? env.AUTHLITE_APP_NAME ?? "Приложение",
    routes: {
      login: options.routes?.login ?? "/login",
      resetPassword: options.routes?.resetPassword ?? "/reset-password",
    },
    trustedOrigins: options.trustedOrigins ?? [],
    email,
    devEmailMode: email.kind === "console",
  };
}

function parseBaseURL(value: string | undefined): string {
  const hint =
    "Задайте переменную окружения AUTHLITE_URL — адрес, по которому пользователи открывают приложение, " +
    "например http://localhost:3000 или https://app.example.com";
  if (!value) throw new AuthLiteConfigError(`Не задан адрес приложения. ${hint}`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AuthLiteConfigError(`AUTHLITE_URL «${value}» — не адрес. ${hint}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AuthLiteConfigError(`AUTHLITE_URL «${value}» должен начинаться с http:// или https://`);
  }
  return url.origin;
}

function resolveEmail(options: AuthLiteOptions, env: Env): AuthLiteSettings["email"] {
  if (options.email?.sender) return { kind: "custom", sender: options.email.sender };
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) return { kind: "console" };
  const from = options.email?.from ?? env.AUTHLITE_EMAIL_FROM;
  if (!from) {
    throw new AuthLiteConfigError(
      "Задан RESEND_API_KEY, но не задан отправитель. Задайте AUTHLITE_EMAIL_FROM, например " +
        "«Моё приложение <no-reply@ваш-домен.ru>» — домен должен быть подтверждён в Resend",
    );
  }
  return { kind: "resend", apiKey, from };
}
