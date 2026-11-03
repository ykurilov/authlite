import type { EmailSender } from "./email-sender.js";

/** Режим разработки: письмо не отправляется, его текст со ссылкой пишется в журнал. */
export function createConsoleSender(log: (line: string) => void = console.log): EmailSender {
  return {
    async send(message) {
      log(`[AuthLite] Режим разработки — письмо не отправлено. Кому: ${message.to}. Тема: ${message.subject}\n${message.text}`);
    },
  };
}
