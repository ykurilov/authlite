import { describe, expect, it } from "vitest";
import { AuthLiteConfigError } from "../src/core/errors.js";
import { resolveSettings } from "../src/core/settings.js";

const secret = "x".repeat(32);
const baseEnv = { AUTHLITE_SECRET: secret, AUTHLITE_URL: "http://localhost:3000" };

describe("resolveSettings", () => {
  it("без секрета останавливает запуск и подсказывает переменную и команду", () => {
    const run = () => resolveSettings({}, { AUTHLITE_URL: "http://localhost:3000" });
    expect(run).toThrow(AuthLiteConfigError);
    expect(run).toThrow(/AUTHLITE_SECRET/);
    expect(run).toThrow(/openssl rand -base64 32/);
  });

  it("слишком короткий секрет отклоняется", () => {
    expect(() => resolveSettings({}, { ...baseEnv, AUTHLITE_SECRET: "short" })).toThrow(/32/);
  });

  it("без адреса приложения останавливает запуск", () => {
    expect(() => resolveSettings({}, { AUTHLITE_SECRET: secret })).toThrow(/AUTHLITE_URL/);
  });

  it("кривой адрес приложения отклоняется", () => {
    expect(() => resolveSettings({}, { ...baseEnv, AUTHLITE_URL: "localhost" })).toThrow(/AUTHLITE_URL/);
  });

  it("без ключа почты включает режим разработки и разумные значения по умолчанию", () => {
    const settings = resolveSettings({}, baseEnv);
    expect(settings.devEmailMode).toBe(true);
    expect(settings.baseURL).toBe("http://localhost:3000");
    expect(settings.databasePath).toMatch(/data[\\/]authlite\.sqlite$/);
    expect(settings.routes).toEqual({ login: "/login", resetPassword: "/reset-password" });
    expect(settings.appName).toBe("Приложение");
  });

  it("с ключом Resend без адреса отправителя — ошибка", () => {
    expect(() => resolveSettings({}, { ...baseEnv, RESEND_API_KEY: "re_test" })).toThrow(/AUTHLITE_EMAIL_FROM/);
  });

  it("с ключом и отправителем — рабочий режим почты", () => {
    const settings = resolveSettings({}, { ...baseEnv, RESEND_API_KEY: "re_test", AUTHLITE_EMAIL_FROM: "App <no-reply@app.ru>" });
    expect(settings.devEmailMode).toBe(false);
  });

  it("свой отправитель отключает режим разработки, а опции главнее окружения", () => {
    const settings = resolveSettings(
      { email: { sender: { send: async () => {} } }, appName: "Заметки", baseURL: "https://notes.ru/" },
      baseEnv,
    );
    expect(settings.devEmailMode).toBe(false);
    expect(settings.appName).toBe("Заметки");
    expect(settings.baseURL).toBe("https://notes.ru");
  });
});
