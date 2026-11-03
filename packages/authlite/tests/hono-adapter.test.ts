import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { getCurrentUser, mountAuthLite, requirePage, requireUser, type AuthLiteVariables } from "../src/hono/index.js";
import { BASE_URL, createTestApp, nextIp, sessionCookie } from "./helpers.js";

function buildApp() {
  const test = createTestApp();
  const app = new Hono<{ Variables: AuthLiteVariables }>();
  mountAuthLite(app, test.authLite);
  app.get("/api/notes", requireUser(test.authLite), (c) => c.json({ owner: c.get("user").email, notes: ["первая"] }));
  app.get("/dashboard", requirePage(test.authLite), (c) => c.text(`Привет, ${c.get("user").email}`));
  app.get("/whoami", async (c) => c.json({ user: await getCurrentUser(test.authLite, c) }));
  return app;
}

async function signUpThroughHono(app: Hono<{ Variables: AuthLiteVariables }>, email: string) {
  const response = await app.request(`${BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE_URL, "x-forwarded-for": nextIp() },
    body: JSON.stringify({ email, password: "password-123", name: "" }),
  });
  expect(response.status).toBe(200);
  return sessionCookie(response);
}

describe("переходник Hono", () => {
  it("обработчик /api/auth/* подключён", async () => {
    const app = buildApp();
    const response = await app.request(`${BASE_URL}/api/auth/get-session`);
    expect(response.status).toBe(200);
  });

  it("защищённый запрос без входа — 401 без данных", async () => {
    const app = buildApp();
    const response = await app.request(`${BASE_URL}/api/notes`);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });

  it("защищённый запрос после входа — данные и пользователь", async () => {
    const app = buildApp();
    const cookie = await signUpThroughHono(app, "hono@example.com");
    const response = await app.request(`${BASE_URL}/api/notes`, { headers: { cookie } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ owner: "hono@example.com", notes: ["первая"] });
    const whoami = await app.request(`${BASE_URL}/whoami`, { headers: { cookie } });
    expect((await whoami.json()).user.email).toBe("hono@example.com");
  });

  it("защищённая страница без входа — на вход с возвратом", async () => {
    const app = buildApp();
    const response = await app.request(`${BASE_URL}/dashboard?tab=2`);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/login?next=%2Fdashboard%3Ftab%3D2");
  });

  it("защищённая страница после входа открывается", async () => {
    const app = buildApp();
    const cookie = await signUpThroughHono(app, "page@example.com");
    const response = await app.request(`${BASE_URL}/dashboard`, { headers: { cookie } });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Привет, page@example.com");
  });
});
