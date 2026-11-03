import type { EmailMessage } from "./email-sender.js";

export function buildResetPasswordEmail({ appName, to, url }: { appName: string; to: string; url: string }): EmailMessage {
  const subject = `Сброс пароля — ${appName}`;
  const text = [
    `Здравствуйте!`,
    ``,
    `Кто-то запросил сброс пароля для вашей учётной записи в «${appName}».`,
    `Чтобы задать новый пароль, откройте ссылку: ${url}`,
    ``,
    `Ссылка действует 1 час и только один раз.`,
    `Если вы не запрашивали сброс, просто проигнорируйте это письмо — пароль останется прежним.`,
  ].join("\n");
  const name = escapeHtml(appName);
  const link = escapeHtml(url);
  const html = `<!doctype html><html lang="ru"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1a1a1a">
<p>Здравствуйте!</p>
<p>Кто-то запросил сброс пароля для вашей учётной записи в «${name}».</p>
<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none">Задать новый пароль</a></p>
<p style="color:#555">Или откройте ссылку: <br><a href="${link}">${link}</a></p>
<p style="color:#555">Ссылка действует 1 час и только один раз. Если вы не запрашивали сброс, просто проигнорируйте это письмо — пароль останется прежним.</p>
</body></html>`;
  return { to, subject, html, text };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
