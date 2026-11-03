export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

export const MESSAGES = {
  invalidCredentials: "Неверный email или пароль",
  tooManyAttempts: "Слишком много попыток, попробуйте позже",
  emailTaken: "Этот email уже зарегистрирован",
  linkExpired: "Ссылка устарела",
  resetRequested: "Если такой адрес зарегистрирован, мы отправили письмо",
  generic: "Что-то пошло не так, попробуйте ещё раз",
  passwordTooShort: `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`,
  passwordTooLong: `Пароль должен быть не длиннее ${MAX_PASSWORD_LENGTH} символов`,
  passwordsDiffer: "Пароли не совпадают",
  invalidEmail: "Введите email, например name@example.com",
} as const;

/** Адрес возврата после входа: только относительный путь внутри приложения. */
export function safeReturnPath(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : MESSAGES.invalidEmail;
}

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return MESSAGES.passwordTooShort;
  if (password.length > MAX_PASSWORD_LENGTH) return MESSAGES.passwordTooLong;
  return null;
}

export function errorMessageFor(status: number, code: string | undefined): string {
  if (status === 429) return MESSAGES.tooManyAttempts;
  if (code === "INVALID_EMAIL_OR_PASSWORD" || status === 401) return MESSAGES.invalidCredentials;
  if (code?.startsWith("USER_ALREADY_EXISTS")) return MESSAGES.emailTaken;
  if (code === "PASSWORD_TOO_SHORT") return MESSAGES.passwordTooShort;
  if (code === "PASSWORD_TOO_LONG") return MESSAGES.passwordTooLong;
  if (code === "INVALID_TOKEN") return MESSAGES.linkExpired;
  if (code === "INVALID_EMAIL") return MESSAGES.invalidEmail;
  return MESSAGES.generic;
}
