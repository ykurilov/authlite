"use client";
import { useEffect, useState, type FormEvent } from "react";
import { authApi } from "./auth-api.js";
import { AuthLayout, FormMessage, readSearchParam, SubmitButton, TextField, withNext, type ScreenBranding } from "./auth-layout.js";
import { normalizeEmail, safeReturnPath, validateEmail } from "./form-helpers.js";

export interface LoginScreenProps extends ScreenBranding {
  signUpHref?: string;
  forgotPasswordHref?: string;
  /** Куда вести после входа, если в адресе нет ?next=. */
  defaultRedirect?: string;
}

export function LoginScreen({ appName, logo, signUpHref = "/signup", forgotPasswordHref = "/forgot-password", defaultRedirect = "/" }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState<string | null>(null);
  const [passwordWasReset, setPasswordWasReset] = useState(false);

  useEffect(() => {
    setNext(readSearchParam("next"));
    setPasswordWasReset(readSearchParam("reset") === "1");
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const emailProblem = validateEmail(email);
    setEmailError(emailProblem);
    if (emailProblem || !password) {
      if (!password) setError("Введите пароль");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await authApi.signIn(normalizeEmail(email), password);
    if (result.ok) {
      window.location.assign(safeReturnPath(next, defaultRedirect));
      return;
    }
    setBusy(false);
    setError(result.message);
  }

  return (
    <AuthLayout appName={appName} logo={logo} title="Вход">
      <form className="authlite-form" onSubmit={submit} noValidate>
        {passwordWasReset && !error && <FormMessage kind="success">Пароль изменён. Войдите с новым паролем.</FormMessage>}
        {error && <FormMessage kind="error">{error}</FormMessage>}
        <TextField label="Email" type="email" name="email" value={email} onChange={setEmail} autoComplete="email" error={emailError} required autoFocus />
        <TextField label="Пароль" type="password" name="password" value={password} onChange={setPassword} autoComplete="current-password" required />
        <div className="authlite-row-end">
          <a className="authlite-link" href={forgotPasswordHref}>Забыли пароль?</a>
        </div>
        <SubmitButton busy={busy}>Войти</SubmitButton>
      </form>
      <p className="authlite-footer">
        Нет учётной записи? <a className="authlite-link" href={withNext(signUpHref, next)}>Зарегистрироваться</a>
      </p>
    </AuthLayout>
  );
}
