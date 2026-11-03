/** Ошибка настройки AuthLite: в тексте — что не так и как исправить. */
export class AuthLiteConfigError extends Error {
  constructor(message: string) {
    super(`[AuthLite] ${message}`);
    this.name = "AuthLiteConfigError";
  }
}
