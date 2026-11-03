import { describe, expect, it, vi } from "vitest";
import { AuthLiteConfigError, createAuthLite } from "../src/index.js";

describe("запуск", () => {
  it("импорт и создание не падают без переменных (сборка приложения проходит), а ready() даёт понятную ошибку", async () => {
    vi.stubEnv("AUTHLITE_SECRET", "");
    vi.stubEnv("AUTHLITE_URL", "");
    const authLite = createAuthLite();
    await expect(authLite.ready()).rejects.toBeInstanceOf(AuthLiteConfigError);
    await expect(authLite.ready()).rejects.toThrow(/AUTHLITE_SECRET/);
    await expect(authLite.handler(new Request("http://localhost/api/auth/get-session"))).rejects.toThrow(/AUTHLITE_SECRET/);
    vi.unstubAllEnvs();
  });

  it("в режиме разработки при запуске выводится предупреждение", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("RESEND_API_KEY", "");
    delete (globalThis as { __authliteWarnings?: Set<string> }).__authliteWarnings;
    const authLite = createAuthLite({
      secret: "s".repeat(32),
      baseURL: "http://localhost:3000",
      databasePath: `${process.env.TMPDIR ?? "/tmp"}/authlite-startup-${Date.now()}.sqlite`,
    });
    await authLite.ready();
    expect(warn.mock.calls.flat().join(" ")).toMatch(/режим разработки/i);
    vi.unstubAllEnvs();
    warn.mockRestore();
  });
});
