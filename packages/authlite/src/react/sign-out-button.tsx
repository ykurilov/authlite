"use client";
import { useState, type ReactNode } from "react";
import { authApi } from "./auth-api.js";

export interface SignOutButtonProps {
  /** Куда вести после выхода. */
  redirectTo?: string;
  className?: string;
  children?: ReactNode;
}

export function SignOutButton({ redirectTo = "/login", className = "authlite-sign-out", children = "Выйти" }: SignOutButtonProps) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await authApi.signOut();
        window.location.assign(redirectTo);
      }}
    >
      {children}
    </button>
  );
}
