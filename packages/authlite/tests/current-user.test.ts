import { describe, expect, it } from "vitest";
import { createTestApp } from "./helpers.js";

describe("getCurrentUser", () => {
  it("без входа — null", async () => {
    const app = createTestApp();
    expect(await app.authLite.getCurrentUser(new Headers())).toBeNull();
    expect(await app.authLite.getCurrentUser(new Headers({ cookie: "better-auth.session_token=forged" }))).toBeNull();
  });

  it("после входа — идентификатор, email и имя; без имени — null", async () => {
    const app = createTestApp();
    const withName = await app.signUp("named@example.com", "password-123", "Борис");
    const withoutName = await app.signUp("noname@example.com", "password-123");
    expect(await app.authLite.getCurrentUser(new Headers({ cookie: withName }))).toEqual({
      id: expect.any(String),
      email: "named@example.com",
      name: "Борис",
    });
    expect(await app.authLite.getCurrentUser(new Headers({ cookie: withoutName }))).toMatchObject({ name: null });
  });

  it("выход в одной вкладке — во второй следующий запрос уже без пользователя", async () => {
    const app = createTestApp();
    const cookie = await app.signUp("tabs@example.com", "password-123");
    const secondTab = new Headers({ cookie });
    expect(await app.authLite.getCurrentUser(secondTab)).not.toBeNull();
    await app.call("/sign-out", { body: {}, cookie });
    expect(await app.authLite.getCurrentUser(secondTab)).toBeNull();
  });
});
