export { createAuthLite, type AuthLite, type AuthLiteUser } from "./core/create-auth-lite.js";
export type { AuthLiteOptions } from "./core/settings.js";
export { AuthLiteConfigError } from "./core/errors.js";
export type { EmailMessage, EmailSender } from "./core/email/email-sender.js";
export { createResendSender, type ResendSenderOptions } from "./core/email/resend-sender.js";
export { createConsoleSender } from "./core/email/console-sender.js";
