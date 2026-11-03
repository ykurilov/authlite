"use client";
import { useEffect, useState, type FormEvent } from "react";
import { authApi } from "./auth-api.js";
import { AuthLayout, FormMessage, readSearchParam, SubmitButton, TextField, type ScreenBranding } from "./auth-layout.js";
import { MESSAGES, MIN_PASSWORD_LENGTH, validatePassword } from "./form-helpers.js";

export interface ResetPasswordScreenProps extends ScreenBranding {
  loginHref?: string;
  forgotPasswordHref?: string;
}

type LinkState = "checking" | "valid" | "expired";

export function ResetPasswordScreen({ appName, logo, loginHref = "/login", forgotPasswordHref = "/forgot-password" }: ResetPasswordScreenProps) {
  const [token, setToken] = useState<string | null>(null);
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ password?: string | null; repeat?: string | null }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fromLink = readSearchParam("token");
    setToken(fromLink);
    setLinkState(fromLink && !readSearchParam("error") ? "valid" : "expired");
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problems = { password: validatePassword(password), repeat: password === repeat ? null : MESSAGES.passwordsDiffer };
    setFieldErrors(problems);
    if (problems.password || problems.repeat || !token) return;
    setBusy(true);
    setError(null);
    const result = await authApi.resetPassword(token, password);
    if (result.ok) {
      // Сессия этого браузера (если была) больше не нужна: входим заново с новым паролем.
      await authApi.signOut();
      window.location.assign(`${loginHref}?reset=1`);
      return;
    }
    setBusy(false);
    if (result.code === "INVALID_TOKEN") setLinkState("expired");
    else setError(result.message);
  }

  if (linkState === "expired") {
    return (
      <AuthLayout appName={appName} logo={logo} title="Новый пароль">
        <div className="authlite-form">
          <FormMessage kind="error">{MESSAGES.linkExpired}</FormMessage>
          <p className="authlite-text">Ссылка действует 1 час и только один раз. Запросите новую — придёт свежее письмо.</p>
          <a className="authlite-button" href={forgotPasswordHref}>Запросить новую</a>
        </div>
        <p className="authlite-footer">
          <a className="authlite-link" href={loginHref}>Вернуться ко входу</a>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout appName={appName} logo={logo} title="Новый пароль">
      <form className="authlite-form" onSubmit={submit} noValidate>
        {error && <FormMessage kind="error">{error}</FormMessage>}
        <TextField
          label="Новый пароль"
          type="password"
          name="new-password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          error={fieldErrors.password}
          hint={`Не короче ${MIN_PASSWORD_LENGTH} символов`}
          required
          autoFocus
        />
        <TextField label="Повторите пароль" type="password" name="repeat-password" value={repeat} onChange={setRepeat} autoComplete="new-password" error={fieldErrors.repeat} required />
        <SubmitButton busy={busy || linkState === "checking"}>Сохранить пароль</SubmitButton>
      </form>
    </AuthLayout>
  );
}
