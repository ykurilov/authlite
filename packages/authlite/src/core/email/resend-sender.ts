import type { EmailSender } from "./email-sender.js";

export interface ResendSenderOptions {
  apiKey: string;
  from: string;
  fetch?: typeof fetch;
}

export function createResendSender({ apiKey, from, fetch: fetchImpl = fetch }: ResendSenderOptions): EmailSender {
  return {
    async send(message) {
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });
      if (!response.ok) {
        const details = await response.text().catch(() => "");
        throw new Error(`Resend ответил ${response.status}: ${details.slice(0, 300)}`);
      }
    },
  };
}
