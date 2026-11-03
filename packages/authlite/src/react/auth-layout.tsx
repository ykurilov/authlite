"use client";
import { useId, useState, type ReactNode } from "react";

export interface ScreenBranding {
  /** Название приложения в шапке экрана. */
  appName?: string;
  /** Логотип: картинка, SVG или любой элемент. */
  logo?: ReactNode;
}

export function AuthLayout({ appName, logo, title, children }: ScreenBranding & { title: string; children: ReactNode }) {
  return (
    <div className="authlite">
      <main className="authlite-card">
        {(logo || appName) && (
          <div className="authlite-brand">
            {logo && <div className="authlite-logo">{logo}</div>}
            {appName && <div className="authlite-app-name">{appName}</div>}
          </div>
        )}
        <h1 className="authlite-title">{title}</h1>
        {children}
      </main>
    </div>
  );
}

export function TextField(props: {
  label: string;
  type: "email" | "password" | "text";
  name: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = props.type === "password";
  const describedBy = props.error ? `${id}-error` : props.hint ? `${id}-hint` : undefined;
  return (
    <div className="authlite-field">
      <label htmlFor={id} className="authlite-label">{props.label}</label>
      <div className="authlite-input-wrap">
        <input
          id={id}
          className="authlite-input"
          name={props.name}
          type={isPassword && visible ? "text" : props.type}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          autoComplete={props.autoComplete}
          required={props.required}
          autoFocus={props.autoFocus}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={describedBy}
          inputMode={props.type === "email" ? "email" : undefined}
          autoCapitalize={props.type === "email" ? "none" : undefined}
          spellCheck={false}
        />
        {isPassword && (
          <button
            type="button"
            className="authlite-toggle"
            onClick={() => setVisible((value) => !value)}
            aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
          >
            {visible ? "Скрыть" : "Показать"}
          </button>
        )}
      </div>
      {props.error ? (
        <p id={`${id}-error`} className="authlite-field-error">{props.error}</p>
      ) : props.hint ? (
        <p id={`${id}-hint`} className="authlite-hint">{props.hint}</p>
      ) : null}
    </div>
  );
}

export function FormMessage({ kind, children }: { kind: "error" | "success" | "info"; children: ReactNode }) {
  return (
    <div className={`authlite-message authlite-message-${kind}`} role={kind === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button type="submit" className="authlite-button" disabled={busy} aria-busy={busy}>
      {busy ? "Подождите…" : children}
    </button>
  );
}

export function readSearchParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

export function withNext(href: string, next: string | null): string {
  if (!next) return href;
  return `${href}${href.includes("?") ? "&" : "?"}next=${encodeURIComponent(next)}`;
}
