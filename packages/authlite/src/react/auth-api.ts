import { errorMessageFor } from "./form-helpers.js";

/** Адрес обработчика AuthLite в приложении-хозяине. */
export const AUTH_API_PATH = "/api/auth";

export type ApiResult<T = unknown> = { ok: true; data: T } | { ok: false; status: number; code?: string; message: string };

async function post<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${AUTH_API_PATH}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    if (response.ok) return { ok: true, data: data as T };
    const code = typeof data?.code === "string" ? data.code : undefined;
    return { ok: false, status: response.status, code, message: errorMessageFor(response.status, code) };
  } catch {
    return { ok: false, status: 0, message: errorMessageFor(0, undefined) };
  }
}

export const authApi = {
  signIn: (email: string, password: string) => post("/sign-in/email", { email, password, rememberMe: true }),
  signUp: (email: string, password: string, name: string) => post("/sign-up/email", { email, password, name }),
  signOut: () => post("/sign-out", {}),
  requestPasswordReset: (email: string, redirectTo: string) => post("/request-password-reset", { email, redirectTo }),
  resetPassword: (token: string, newPassword: string) => post("/reset-password", { token, newPassword }),
  async getSession(): Promise<{ user: { id: string; email: string; name: string } } | null> {
    const response = await fetch(`${AUTH_API_PATH}/get-session`, { credentials: "same-origin" });
    if (!response.ok) return null;
    return response.json();
  },
};
