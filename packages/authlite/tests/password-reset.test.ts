import { afterEach, describe, expect, it, vi } from "vitest";
import { BASE_URL, createTestApp, type TestApp } from "./helpers.js";

const OLD_PASSWORD = "old-password-111";
const NEW_PASSWORD = "new-password-222";

async function requestReset(app: TestApp, email: string, ip?: string) {
  return app.call("/request-password-reset", { body: { email, redirectTo: "/reset-password" }, ip });
}

/** Ждёт письмо (отправка идёт в фоне) и достаёт из него ссылку. */
async function waitForResetLink(app: TestApp, count = 1): Promise<string> {
  await vi.waitFor(() => expect(app.sentEmails.length).toBe(count));
  const link = /(https?:\/\/\S+)/.exec(app.sentEmails[count - 1]!.text)?.[1];
  expect(link).toBeDefined();
  return link!;
}

/** Переход по ссылке из письма: Better Auth отправляет на экран нового пароля с токеном. */
async function openLink(app: TestApp, link: string): Promise<URL> {
  const url = new URL(link);
  const response = await app.call(url.pathname.replace("/api/auth", "") + url.search);
  expect(response.status).toBe(302);
  return new URL(response.headers.get("location")!, BASE_URL);
}

async function setNewPassword(app: TestApp, token: string, newPassword = NEW_PASSWORD) {
  return app.call("/reset-password", { body: { token, newPassword } });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("сброс пароля", () => {
  it("на зарегистрированный адрес уходит письмо со ссылкой; ответ такой же, как для незарегистрированного", async () => {
    const app = createTestApp();
    await app.signUp("known@example.com", OLD_PASSWORD);
    const known = await requestReset(app, "known@example.com");
    const unknown = await requestReset(app, "unknown@example.com");
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(unknown.status);
    expect(await known.json()).toEqual(await unknown.json());
    await waitForResetLink(app);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(app.sentEmails.map((email) => email.to)).toEqual(["known@example.com"]);
    expect(app.sentEmails[0]!.subject).toContain("Тестовое приложение");
  });

  it("адрес с пробелами и заглавными находит того же пользователя", async () => {
    const app = createTestApp();
    await app.signUp("case@example.com", OLD_PASSWORD);
    await requestReset(app, "  CASE@Example.com ");
    await waitForResetLink(app);
  });

  it("ссылка ведёт на экран нового пароля; новый пароль работает, старый — нет, прежние сессии закрыты", async () => {
    const app = createTestApp();
    const oldSession = await app.signUp("reset@example.com", OLD_PASSWORD);
    await requestReset(app, "reset@example.com");
    const landing = await openLink(app, await waitForResetLink(app));
    expect(landing.origin + landing.pathname).toBe(`${BASE_URL}/reset-password`);
    const token = landing.searchParams.get("token")!;
    expect(token).toBeTruthy();

    expect((await setNewPassword(app, token)).status).toBe(200);
    expect(await app.authLite.getCurrentUser(new Headers({ cookie: oldSession }))).toBeNull();
    expect((await app.signIn("reset@example.com", OLD_PASSWORD)).status).toBe(401);
    expect((await app.signIn("reset@example.com", NEW_PASSWORD)).status).toBe(200);
  });

  it("ссылка одноразовая: второй раз — «устарела»", async () => {
    const app = createTestApp();
    await app.signUp("once@example.com", OLD_PASSWORD);
    await requestReset(app, "once@example.com");
    const link = await waitForResetLink(app);
    const token = (await openLink(app, link)).searchParams.get("token")!;
    expect((await setNewPassword(app, token)).status).toBe(200);

    const again = await setNewPassword(app, token, "third-password-3");
    expect(again.status).toBe(400);
    expect((await again.json()).code).toBe("INVALID_TOKEN");
    expect((await openLink(app, link)).searchParams.get("error")).toBe("INVALID_TOKEN");
  });

  it("из двух ссылок подряд работает только последняя", async () => {
    const app = createTestApp();
    await app.signUp("twice@example.com", OLD_PASSWORD);
    await requestReset(app, "twice@example.com");
    const firstLink = await waitForResetLink(app, 1);
    await requestReset(app, "twice@example.com");
    const secondLink = await waitForResetLink(app, 2);

    expect((await openLink(app, firstLink)).searchParams.get("error")).toBe("INVALID_TOKEN");
    const firstToken = new URL(firstLink).pathname.split("/").pop()!;
    expect((await setNewPassword(app, firstToken)).status).toBe(400);

    const secondToken = (await openLink(app, secondLink)).searchParams.get("token")!;
    expect((await setNewPassword(app, secondToken)).status).toBe(200);
  });

  it("ссылка действует 1 час", async () => {
    const app = createTestApp();
    await app.signUp("expiry@example.com", OLD_PASSWORD);
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = new Date("2026-11-03T10:00:00Z");
    vi.setSystemTime(start);
    await requestReset(app, "expiry@example.com");
    const link = await waitForResetLink(app);

    vi.setSystemTime(new Date(start.getTime() + 59 * 60 * 1000));
    const token = (await openLink(app, link)).searchParams.get("token");
    expect(token).toBeTruthy();

    vi.setSystemTime(new Date(start.getTime() + 61 * 60 * 1000));
    expect((await openLink(app, link)).searchParams.get("error")).toBe("INVALID_TOKEN");
    const late = await setNewPassword(app, token!);
    expect(late.status).toBe(400);
    expect((await late.json()).code).toBe("INVALID_TOKEN");
  });

  it("сбой почтового сервиса: пользователь видит то же сообщение, ошибка — в журнале", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = createTestApp({
      email: {
        sender: {
          send: async () => {
            throw new Error("почтовый сервис недоступен");
          },
        },
      },
    });
    await app.signUp("down@example.com", OLD_PASSWORD);
    const failed = await requestReset(app, "down@example.com");
    const unknown = await requestReset(app, "nobody@example.com");
    expect(failed.status).toBe(200);
    expect(await failed.json()).toEqual(await unknown.json());
    await vi.waitFor(() => expect(errors.mock.calls.flat().join(" ")).toMatch(/почтовый сервис недоступен/));
  });

  it("запрос без адреса возврата всё равно даёт рабочую ссылку на экран приложения", async () => {
    const app = createTestApp();
    await app.signUp("noredirect@example.com", OLD_PASSWORD);
    await app.call("/request-password-reset", { body: { email: "noredirect@example.com" } });
    const landing = await openLink(app, await waitForResetLink(app));
    expect(landing.pathname).toBe("/reset-password");
    expect(landing.searchParams.get("token")).toBeTruthy();
  });

  it("режим разработки: письмо не отправляется, ссылка — в журнале сервера", async () => {
    const logs = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("RESEND_API_KEY", "");
    const app = createTestApp({ email: undefined });
    await app.signUp("dev@example.com", OLD_PASSWORD);
    await requestReset(app, "dev@example.com");
    await vi.waitFor(() => expect(logs.mock.calls.flat().join("\n")).toMatch(/\/api\/auth\/reset-password\/\w+/));
    vi.unstubAllEnvs();
  });
});

describe("пароль нигде не всплывает (SC-006)", () => {
  it("ни в письмах, ни в журналах, ни в ответах", async () => {
    const output: string[] = [];
    for (const method of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => void output.push(args.map(String).join(" ")));
    }
    const app = createTestApp();
    const bodies: string[] = [];
    const record = async (response: Response) => {
      bodies.push(await response.clone().text(), JSON.stringify([...response.headers]));
      return response;
    };
    const SECRET_PASSWORD = "Секретный-Пароль-987";
    const NEXT_SECRET_PASSWORD = "Другой-Секрет-654";
    await record(await app.call("/sign-up/email", { body: { email: "leak@example.com", password: SECRET_PASSWORD, name: "" } }));
    await record(await app.call("/sign-up/email", { body: { email: "leak@example.com", password: SECRET_PASSWORD, name: "" } }));
    await record(await app.call("/sign-up/email", { body: { email: "short@example.com", password: "Ко-рот", name: "" } }));
    await record(await app.signIn("leak@example.com", SECRET_PASSWORD + "x"));
    await record(await app.signIn("leak@example.com", SECRET_PASSWORD));
    await record(await requestReset(app, "leak@example.com"));
    const link = await waitForResetLink(app);
    const token = (await openLink(app, link)).searchParams.get("token")!;
    await record(await setNewPassword(app, token, NEXT_SECRET_PASSWORD));
    await record(await app.signIn("leak@example.com", NEXT_SECRET_PASSWORD));

    const everything = [...bodies, ...output, ...app.sentEmails.flatMap((email) => [email.subject, email.text, email.html])].join("\n");
    for (const secret of [SECRET_PASSWORD, NEXT_SECRET_PASSWORD, "Ко-рот"]) {
      expect(everything).not.toContain(secret);
    }
  });
});
