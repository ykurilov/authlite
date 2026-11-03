import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { createTestApp, sessionCookie } from "./helpers.js";

const PASSWORD = "correct-horse-1";

describe("регистрация, вход и выход", () => {
  it("таблицы создаются сами при первом запросе", async () => {
    const app = createTestApp();
    await app.authLite.ready();
    const db = new DatabaseSync(app.databasePath);
    const tables = db.prepare("select name from sqlite_master where type = 'table'").all().map((row) => row.name);
    db.close();
    expect(tables).toEqual(expect.arrayContaining(["user", "session", "account", "verification"]));
  });

  it("регистрация создаёт учётную запись и сразу входит", async () => {
    const app = createTestApp();
    const cookie = await app.signUp("new@example.com", PASSWORD, "Аня");
    const user = await app.authLite.getCurrentUser(new Headers({ cookie }));
    expect(user).toMatchObject({ email: "new@example.com", name: "Аня" });
    expect(typeof user?.id).toBe("string");
  });

  it("повторная регистрация с тем же email (пробелы, регистр) отклоняется, запись не меняется", async () => {
    const app = createTestApp();
    await app.signUp("same@example.com", PASSWORD, "Первый");
    const response = await app.call("/sign-up/email", {
      body: { email: "  Same@Example.COM ", password: "another-pass-2", name: "Второй" },
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    const body = await response.json();
    expect(body.code).toMatch(/USER_ALREADY_EXISTS/);
    expect((await app.signIn("same@example.com", PASSWORD)).status).toBe(200);
    const db = new DatabaseSync(app.databasePath);
    const rows = db.prepare("select email, name from user").all();
    db.close();
    expect(rows).toEqual([{ email: "same@example.com", name: "Первый" }]);
  });

  it("email с пробелами и заглавными сохраняется в едином виде и подходит для входа", async () => {
    const app = createTestApp();
    await app.signUp("  Mixed@Example.COM  ", PASSWORD);
    expect((await app.signIn("mixed@example.com", PASSWORD)).status).toBe(200);
    expect((await app.signIn(" MIXED@example.com", PASSWORD)).status).toBe(200);
  });

  it("пароль короче 8 и длиннее 128 символов отклоняется сервером", async () => {
    const app = createTestApp();
    const short = await app.call("/sign-up/email", { body: { email: "s@example.com", password: "1234567", name: "" } });
    expect(short.status).toBe(400);
    expect((await short.json()).code).toBe("PASSWORD_TOO_SHORT");
    const long = await app.call("/sign-up/email", { body: { email: "l@example.com", password: "a".repeat(129), name: "" } });
    expect(long.status).toBe(400);
    expect((await long.json()).code).toBe("PASSWORD_TOO_LONG");
    expect((await app.call("/sign-up/email", { body: { email: "ok@example.com", password: "a".repeat(128), name: "" } })).status).toBe(200);
  });

  it("неверный пароль — 401 без уточнения, верный — вход", async () => {
    const app = createTestApp();
    await app.signUp("user@example.com", PASSWORD);
    const wrong = await app.signIn("user@example.com", "wrong-password");
    expect(wrong.status).toBe(401);
    expect((await wrong.json()).code).toBe("INVALID_EMAIL_OR_PASSWORD");
    const unknown = await app.signIn("nobody@example.com", PASSWORD);
    expect(unknown.status).toBe(401);
    expect((await unknown.json()).code).toBe("INVALID_EMAIL_OR_PASSWORD");
    expect((await app.signIn("user@example.com", PASSWORD)).status).toBe(200);
  });

  it("выход закрывает сессию", async () => {
    const app = createTestApp();
    const cookie = await app.signUp("out@example.com", PASSWORD);
    const signOut = await app.call("/sign-out", { body: {}, cookie });
    expect(signOut.status).toBe(200);
    expect(await app.authLite.getCurrentUser(new Headers({ cookie }))).toBeNull();
  });

  it("cookie сессии постоянная — 30 дней, переживает перезапуск браузера", async () => {
    const app = createTestApp();
    await app.signUp("keep@example.com", PASSWORD);
    const response = await app.signIn("keep@example.com", PASSWORD);
    const tokenCookie = response.headers.getSetCookie().find((line) => line.includes("session_token="));
    expect(tokenCookie).toBeDefined();
    const maxAge = Number(/Max-Age=(\d+)/i.exec(tokenCookie!)?.[1]);
    expect(maxAge).toBe(30 * 24 * 60 * 60);
    expect(tokenCookie).toMatch(/HttpOnly/i);
    expect(sessionCookie(response)).toContain("session_token=");
  });

  it("телеметрия выключена явно, сессия 30 дней с продлением раз в сутки", () => {
    const app = createTestApp();
    const options = app.authLite.betterAuth.options;
    expect(options.telemetry?.enabled).toBe(false);
    expect(options.session?.expiresIn).toBe(30 * 24 * 60 * 60);
    expect(options.session?.updateAge).toBe(24 * 60 * 60);
  });
});
