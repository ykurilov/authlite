import { afterEach, describe, expect, it, vi } from "vitest";
import { createResetRequestLimiter } from "../src/core/reset-request-limiter.js";
import { createTestApp, nextIp, type TestApp } from "./helpers.js";

const PASSWORD = "password-12345";

function requestReset(app: TestApp, email: string, ip: string) {
  return app.call("/request-password-reset", { body: { email, redirectTo: "/reset-password" }, ip });
}

/** Даёт фоновой отправке писем завершиться. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

afterEach(() => {
  vi.useRealTimers();
});

describe("ограничение попыток входа", () => {
  it("6-я попытка за минуту с одного адреса — 429, с другого адреса вход работает", async () => {
    const app = createTestApp();
    await app.signUp("brute@example.com", PASSWORD);
    const ip = nextIp();
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect((await app.signIn("brute@example.com", "wrong-password", ip)).status).toBe(401);
    }
    expect((await app.signIn("brute@example.com", PASSWORD, ip)).status).toBe(429);
    expect((await app.signIn("brute@example.com", PASSWORD, nextIp())).status).toBe(200);
  });

  it("через минуту с того же адреса снова можно", async () => {
    const app = createTestApp();
    await app.signUp("wait@example.com", PASSWORD);
    const ip = nextIp();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-03T10:00:00Z"));
    for (let attempt = 1; attempt <= 5; attempt += 1) await app.signIn("wait@example.com", "wrong-password", ip);
    expect((await app.signIn("wait@example.com", PASSWORD, ip)).status).toBe(429);
    vi.setSystemTime(new Date("2026-11-03T10:01:05Z"));
    expect((await app.signIn("wait@example.com", PASSWORD, ip)).status).toBe(200);
  });
});

describe("ограничение запросов сброса", () => {
  it("4-й запрос за 10 минут с одного адреса — 429 и без письма", async () => {
    const app = createTestApp();
    const ip = nextIp();
    const emails = ["r1@example.com", "r2@example.com", "r3@example.com", "r4@example.com"];
    // Регистрации — с разных адресов: у Better Auth свой лимит 3 регистрации за 10 секунд.
    for (const email of emails) await app.call("/sign-up/email", { body: { email, password: PASSWORD, name: "" }, ip: nextIp() });
    for (const email of emails.slice(0, 3)) expect((await requestReset(app, email, ip)).status).toBe(200);
    expect((await requestReset(app, emails[3]!, ip)).status).toBe(429);
    await settle();
    expect(app.sentEmails.map((email) => email.to)).toEqual(emails.slice(0, 3));
  });

  it("4-й запрос на один email с разных адресов — без письма, ответ тот же", async () => {
    const app = createTestApp();
    await app.signUp("target@example.com", PASSWORD);
    const answers: unknown[] = [];
    for (let request = 1; request <= 4; request += 1) {
      const response = await requestReset(app, "target@example.com", nextIp());
      expect(response.status).toBe(200);
      answers.push(await response.json());
    }
    await settle();
    expect(app.sentEmails).toHaveLength(3);
    expect(new Set(answers.map((answer) => JSON.stringify(answer))).size).toBe(1);
  });

  it("лимит на email не зависит от регистра и пробелов", async () => {
    const app = createTestApp();
    await app.signUp("mixed@example.com", PASSWORD);
    for (const variant of ["mixed@example.com", "MIXED@example.com", " Mixed@Example.com ", "mixed@EXAMPLE.com"]) {
      await requestReset(app, variant, nextIp());
    }
    await settle();
    expect(app.sentEmails).toHaveLength(3);
  });
});

describe("счётчик запросов сброса на email", () => {
  it("3 запроса за 10 минут, затем отказ, через 10 минут снова можно", () => {
    let now = 0;
    const limiter = createResetRequestLimiter({ max: 3, windowMs: 10 * 60 * 1000, now: () => now });
    expect([limiter.tryAcquire("a@example.com"), limiter.tryAcquire("a@example.com"), limiter.tryAcquire("a@example.com")]).toEqual([true, true, true]);
    expect(limiter.tryAcquire("a@example.com")).toBe(false);
    expect(limiter.tryAcquire("b@example.com")).toBe(true);
    now = 10 * 60 * 1000 + 1;
    expect(limiter.tryAcquire("a@example.com")).toBe(true);
  });

  it("окно скользящее: освобождается место самого старого запроса", () => {
    let now = 0;
    const limiter = createResetRequestLimiter({ max: 3, windowMs: 600_000, now: () => now });
    limiter.tryAcquire("a@example.com");
    now = 300_000;
    limiter.tryAcquire("a@example.com");
    limiter.tryAcquire("a@example.com");
    now = 600_001;
    expect(limiter.tryAcquire("a@example.com")).toBe(true);
    expect(limiter.tryAcquire("a@example.com")).toBe(false);
  });

  it("не растёт без конца: старые адреса забываются", () => {
    let now = 0;
    const limiter = createResetRequestLimiter({ max: 3, windowMs: 1000, now: () => now });
    for (let index = 0; index < 1000; index += 1) limiter.tryAcquire(`user${index}@example.com`);
    now = 5000;
    limiter.tryAcquire("fresh@example.com");
    expect(limiter.size()).toBe(1);
  });
});
