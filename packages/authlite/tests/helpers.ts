import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAuthLite, type AuthLite, type AuthLiteOptions, type EmailMessage } from "../src/index.js";

export const BASE_URL = "http://localhost:3000";
export const SECRET = "test-secret-test-secret-test-secret-123";

let ipCounter = 0;
/** Уникальный адрес подключения: ограничитель частоты Better Auth общий на процесс. */
export function nextIp(): string {
  ipCounter += 1;
  return `10.${Math.floor(ipCounter / 65536) % 256}.${Math.floor(ipCounter / 256) % 256}.${ipCounter % 256}`;
}

export interface TestApp {
  authLite: AuthLite;
  sentEmails: EmailMessage[];
  databasePath: string;
  /** Запрос к /api/auth/* с адресом подключения и cookie. */
  call(path: string, init?: { method?: string; body?: unknown; cookie?: string; ip?: string }): Promise<Response>;
  signUp(email: string, password: string, name?: string): Promise<string>;
  signIn(email: string, password: string, ip?: string): Promise<Response>;
}

export function createTestApp(options: AuthLiteOptions = {}): TestApp {
  const databasePath = join(mkdtempSync(join(tmpdir(), "authlite-test-")), "auth.sqlite");
  const sentEmails: EmailMessage[] = [];
  const authLite = createAuthLite({
    secret: SECRET,
    baseURL: BASE_URL,
    databasePath,
    appName: "Тестовое приложение",
    email: { sender: { send: async (message) => void sentEmails.push(message) } },
    ...options,
  });
  const defaultIp = nextIp();

  const call: TestApp["call"] = (path, init = {}) => {
    const headers = new Headers({ origin: BASE_URL, "x-forwarded-for": init.ip ?? defaultIp });
    if (init.body !== undefined) headers.set("content-type", "application/json");
    if (init.cookie) headers.set("cookie", init.cookie);
    return authLite.handler(
      new Request(`${BASE_URL}/api/auth${path}`, {
        method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
        headers,
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        redirect: "manual",
      }),
    );
  };

  return {
    authLite,
    sentEmails,
    databasePath,
    call,
    async signUp(email, password, name = "") {
      const response = await call("/sign-up/email", { body: { email, password, name } });
      if (response.status !== 200) throw new Error(`sign-up ${response.status}: ${await response.text()}`);
      return sessionCookie(response);
    },
    signIn(email, password, ip) {
      return call("/sign-in/email", { body: { email, password, rememberMe: true }, ip });
    },
  };
}

/** Cookie сессии из ответа в виде «имя=значение» для следующего запроса. */
export function sessionCookie(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((line) => line.split(";")[0]!)
    .filter((pair) => !pair.endsWith("="))
    .join("; ");
}

export function headersWithCookie(cookie: string): Headers {
  return new Headers({ cookie });
}
