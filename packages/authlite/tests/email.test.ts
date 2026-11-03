import { describe, expect, it, vi } from "vitest";
import { createConsoleSender } from "../src/core/email/console-sender.js";
import { createResendSender } from "../src/core/email/resend-sender.js";
import { buildResetPasswordEmail } from "../src/core/email/reset-password-email.js";

const message = { to: "user@example.com", subject: "Тема", html: "<p>Привет</p>", text: "Привет" };

describe("createResendSender", () => {
  it("отправляет письмо через HTTP API Resend", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "1" }), { status: 200 }));
    const sender = createResendSender({ apiKey: "re_key", from: "App <a@app.ru>", fetch: fetchMock });
    await sender.send(message);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer re_key");
    expect(JSON.parse(String(init.body))).toEqual({
      from: "App <a@app.ru>",
      to: ["user@example.com"],
      subject: "Тема",
      html: "<p>Привет</p>",
      text: "Привет",
    });
  });

  it("ошибка сервиса — исключение с кодом ответа", async () => {
    const fetchMock = vi.fn(async () => new Response("bad", { status: 422 }));
    const sender = createResendSender({ apiKey: "re_key", from: "a@app.ru", fetch: fetchMock });
    await expect(sender.send(message)).rejects.toThrow(/422/);
  });
});

describe("createConsoleSender", () => {
  it("пишет письмо в журнал вместо отправки", async () => {
    const lines: string[] = [];
    await createConsoleSender((line) => lines.push(line)).send({ ...message, text: "Ссылка: https://app.ru/x" });
    expect(lines.join("\n")).toContain("https://app.ru/x");
    expect(lines.join("\n")).toContain("user@example.com");
  });
});

describe("buildResetPasswordEmail", () => {
  it("русское письмо с названием приложения и ссылкой", () => {
    const email = buildResetPasswordEmail({ appName: "Заметки <&>", to: "u@x.ru", url: "https://app.ru/reset?a=1&b=2" });
    expect(email.to).toBe("u@x.ru");
    expect(email.subject).toContain("Заметки");
    expect(email.subject).toMatch(/парол/i);
    expect(email.text).toContain("https://app.ru/reset?a=1&b=2");
    expect(email.text).toMatch(/1 час/);
    expect(email.html).toContain("Заметки &lt;&amp;&gt;");
    expect(email.html).toContain("https://app.ru/reset?a=1&amp;b=2");
  });
});
