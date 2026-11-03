import { beforeEach, describe, expect, it, vi } from "vitest";

const nextState = vi.hoisted(() => ({ headers: new Headers() }));

vi.mock("next/headers", () => ({ headers: async () => nextState.headers }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

const { createNextAuth } = await import("../src/next/index.js");
const { BASE_URL, createTestApp, nextIp, sessionCookie } = await import("./helpers.js");

function setup() {
  const test = createTestApp();
  return { test, next: createNextAuth(test.authLite) };
}

async function signUp(handlers: { POST(request: Request): Promise<Response> }, email: string) {
  const response = await handlers.POST(
    new Request(`${BASE_URL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL, "x-forwarded-for": nextIp() },
      body: JSON.stringify({ email, password: "password-123", name: "Next" }),
    }),
  );
  expect(response.status).toBe(200);
  return sessionCookie(response);
}

describe("переходник Next.js", () => {
  beforeEach(() => {
    nextState.headers = new Headers();
  });

  it("обработчики GET и POST ведут в AuthLite", async () => {
    const { next } = setup();
    const response = await next.handlers.GET(new Request(`${BASE_URL}/api/auth/get-session`));
    expect(response.status).toBe(200);
  });

  it("getCurrentUser читает cookie из заголовков запроса Next", async () => {
    const { next } = setup();
    expect(await next.getCurrentUser()).toBeNull();
    nextState.headers = new Headers({ cookie: await signUp(next.handlers, "rsc@example.com") });
    expect(await next.getCurrentUser()).toMatchObject({ email: "rsc@example.com", name: "Next" });
  });

  it("requireUser без входа перенаправляет на вход с адресом возврата", async () => {
    const { next } = setup();
    await expect(next.requireUser("/dashboard")).rejects.toThrow("NEXT_REDIRECT:/login?next=%2Fdashboard");
  });

  it("requireUser после входа возвращает пользователя", async () => {
    const { next } = setup();
    nextState.headers = new Headers({ cookie: await signUp(next.handlers, "page@example.com") });
    expect(await next.requireUser("/dashboard")).toMatchObject({ email: "page@example.com" });
  });

  it("withUser: без входа 401, после входа — обработчик получает пользователя", async () => {
    const { next } = setup();
    const route = next.withUser(async (_request, user) => Response.json({ email: user.email }));
    const anonymous = await route(new Request(`${BASE_URL}/api/notes`));
    expect(anonymous.status).toBe(401);
    expect(await anonymous.json()).toEqual({ error: "unauthorized" });
    const cookie = await signUp(next.handlers, "api@example.com");
    const signedIn = await route(new Request(`${BASE_URL}/api/notes`, { headers: { cookie } }));
    expect(await signedIn.json()).toEqual({ email: "api@example.com" });
  });

  it("startup() при ошибке настройки печатает подсказку и останавливает процесс", async () => {
    const { createAuthLite } = await import("../src/index.js");
    vi.stubEnv("AUTHLITE_SECRET", "");
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await createNextAuth(createAuthLite({ baseURL: BASE_URL })).startup();
    expect(exit).toHaveBeenCalledWith(1);
    expect(error.mock.calls.flat().join(" ")).toMatch(/AUTHLITE_SECRET/);
    exit.mockRestore();
    error.mockRestore();
    vi.unstubAllEnvs();
  });

  it("startup() при верных настройках готовит базу и не останавливает процесс", async () => {
    const { next, test } = setup();
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    await next.startup();
    expect(exit).not.toHaveBeenCalled();
    expect(test.authLite.settings.baseURL).toBe(BASE_URL);
    exit.mockRestore();
  });
});
