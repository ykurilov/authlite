"use client";
import { useEffect, useState, type FormEvent } from "react";
import { authApi } from "./auth-api.js";
import { AuthLayout, FormMessage, readSearchParam, SubmitButton, TextField, withNext, type ScreenBranding } from "./auth-layout.js";
import { MIN_PASSWORD_LENGTH, normalizeEmail, safeReturnPath, validateEmail, validatePassword } from "./form-helpers.js";

export interface SignUpScreenProps extends ScreenBranding {
  loginHref?: string;
  /** Куда вести после регистрации, если в адресе нет ?next=. */
  defaultRedirect?: string;
}

export function SignUpScreen({ appName, logo, loginHref = "/login", defaultRedirect = "/" }: SignUpScreenProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string | null; password?: string | null }>({});
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState<string | null>(null);

  useEffect(() => setNext(readSearchParam("next")), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problems = { email: validateEmail(email), password: validatePassword(password) };
    setFieldErrors(problems);
    if (problems.email || problems.password) return;
    setBusy(true);
    setError(null);
    const result = await authApi.signUp(normalizeEmail(email), password, name.trim());
    if (result.ok) {
      window.location.assign(safeReturnPath(next, defaultRedirect));
      return;
    }
    setBusy(false);
    setError(result.message);
  }

  return (
    <AuthLayout appName={appName} logo={logo} title="Регистрация">
      <form className="authlite-form" onSubmit={submit} noValidate>
        {error && <FormMessage kind="error">{error}</FormMessage>}
        <TextField label="Имя (необязательно)" type="text" name="name" value={name} onChange={setName} autoComplete="name" />
        <TextField label="Email" type="email" name="email" value={email} onChange={setEmail} autoComplete="email" error={fieldErrors.email} required />
        <TextField
          label="Пароль"
          type="password"
          name="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          error={fieldErrors.password}
          hint={`Не короче ${MIN_PASSWORD_LENGTH} символов`}
          required
        />
        <SubmitButton busy={busy}>Зарегистрироваться</SubmitButton>
      </form>
      <p className="authlite-footer">
        Уже есть учётная запись? <a className="authlite-link" href={withNext(loginHref, next)}>Войти</a>
      </p>
    </AuthLayout>
  );
}
