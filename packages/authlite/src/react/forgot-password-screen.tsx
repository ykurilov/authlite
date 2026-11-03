"use client";
import { useState, type FormEvent } from "react";
import { authApi } from "./auth-api.js";
import { AuthLayout, FormMessage, SubmitButton, TextField, type ScreenBranding } from "./auth-layout.js";
import { MESSAGES, normalizeEmail, validateEmail } from "./form-helpers.js";

export interface ForgotPasswordScreenProps extends ScreenBranding {
  loginHref?: string;
  /** Адрес экрана нового пароля в приложении: туда ведёт ссылка из письма. */
  resetPasswordPath?: string;
}

export function ForgotPasswordScreen({ appName, logo, loginHref = "/login", resetPasswordPath = "/reset-password" }: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const emailProblem = validateEmail(email);
    setEmailError(emailProblem);
    if (emailProblem) return;
    setBusy(true);
    setError(null);
    const result = await authApi.requestPasswordReset(normalizeEmail(email), resetPasswordPath);
    setBusy(false);
    if (result.ok) setSent(true);
    else setError(result.message);
  }

  return (
    <AuthLayout appName={appName} logo={logo} title="Восстановление пароля">
      {sent ? (
        <div className="authlite-form">
          <FormMessage kind="success">{MESSAGES.resetRequested}</FormMessage>
          <p className="authlite-text">Откройте ссылку из письма в течение часа. Письма нет — проверьте папку «Спам».</p>
        </div>
      ) : (
        <form className="authlite-form" onSubmit={submit} noValidate>
          <p className="authlite-text">Укажите email — пришлём ссылку для нового пароля.</p>
          {error && <FormMessage kind="error">{error}</FormMessage>}
          <TextField label="Email" type="email" name="email" value={email} onChange={setEmail} autoComplete="email" error={emailError} required autoFocus />
          <SubmitButton busy={busy}>Отправить ссылку</SubmitButton>
        </form>
      )}
      <p className="authlite-footer">
        <a className="authlite-link" href={loginHref}>Вернуться ко входу</a>
      </p>
    </AuthLayout>
  );
}
