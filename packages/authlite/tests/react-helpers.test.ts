import { describe, expect, it } from "vitest";
import { errorMessageFor, safeReturnPath, validateEmail, validatePassword } from "../src/react/form-helpers.js";

describe("safeReturnPath", () => {
  it("пропускает только относительные пути внутри приложения", () => {
    expect(safeReturnPath("/dashboard?tab=1", "/")).toBe("/dashboard?tab=1");
    expect(safeReturnPath(null, "/")).toBe("/");
    expect(safeReturnPath("https://evil.example", "/")).toBe("/");
    expect(safeReturnPath("//evil.example", "/")).toBe("/");
    expect(safeReturnPath("/\\evil.example", "/")).toBe("/");
    expect(safeReturnPath("javascript:alert(1)", "/")).toBe("/");
  });
});

describe("проверка полей до отправки", () => {
  it("пароль 8–128 символов", () => {
    expect(validatePassword("1234567")).toMatch(/не короче 8/);
    expect(validatePassword("a".repeat(129))).toMatch(/не длиннее 128/);
    expect(validatePassword("12345678")).toBeNull();
  });

  it("email", () => {
    expect(validateEmail("")).toMatch(/email/i);
    expect(validateEmail("not-an-email")).toMatch(/email/i);
    expect(validateEmail("  a@b.ru ")).toBeNull();
  });
});

describe("errorMessageFor", () => {
  it("переводит ответы сервера в понятные русские сообщения", () => {
    expect(errorMessageFor(401, "INVALID_EMAIL_OR_PASSWORD")).toBe("Неверный email или пароль");
    expect(errorMessageFor(429, undefined)).toBe("Слишком много попыток, попробуйте позже");
    expect(errorMessageFor(422, "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL")).toBe("Этот email уже зарегистрирован");
    expect(errorMessageFor(400, "PASSWORD_TOO_SHORT")).toMatch(/не короче 8/);
    expect(errorMessageFor(400, "INVALID_TOKEN")).toBe("Ссылка устарела");
    expect(errorMessageFor(500, undefined)).toMatch(/попробуйте ещё раз/);
  });
});
