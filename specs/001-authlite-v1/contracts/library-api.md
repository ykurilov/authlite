# Contract: публичный API пакета `@ykurilov/authlite`

## `@ykurilov/authlite` (сервер)

```ts
createAuthLite(options?: AuthLiteOptions): AuthLite

interface AuthLiteOptions {
  secret?: string;        // по умолчанию AUTHLITE_SECRET; обязателен, ≥ 32 символов
  baseURL?: string;       // по умолчанию AUTHLITE_URL; обязателен, например https://app.example.com
  databasePath?: string;  // по умолчанию AUTHLITE_DB_PATH или ./data/authlite.sqlite
  appName?: string;       // по умолчанию AUTHLITE_APP_NAME или "Приложение"; в письмах
  email?: {
    sender?: EmailSender; // свой провайдер; иначе Resend при RESEND_API_KEY, иначе режим разработки
    from?: string;        // по умолчанию AUTHLITE_EMAIL_FROM; обязателен при Resend
  };
  routes?: { login?: string; resetPassword?: string }; // по умолчанию "/login", "/reset-password"
  trustedOrigins?: string[];
}

interface AuthLite {
  handler(request: Request): Promise<Response>;   // все /api/auth/*
  getCurrentUser(headers: Headers): Promise<AuthLiteUser | null>;
  ready(): Promise<void>;                          // миграции; вызывается внутри handler/getCurrentUser
  betterAuth: Auth;                                // запасной выход к Better Auth
  settings: { baseURL: string; routes: { login: string; resetPassword: string }; devEmailMode: boolean };
}

interface EmailSender { send(message: { to: string; subject: string; html: string; text: string }): Promise<void> }
createResendSender(options: { apiKey: string; from: string; fetch?: typeof fetch }): EmailSender
createConsoleSender(log?: (line: string) => void): EmailSender

class AuthLiteConfigError extends Error {} // понятная ошибка запуска: что задать и как
```

## `@ykurilov/authlite/next`

```ts
createNextAuth(authLite: AuthLite): {
  handlers: { GET(req: Request): Promise<Response>; POST(req: Request): Promise<Response> };
  getCurrentUser(): Promise<AuthLiteUser | null>;            // в серверных компонентах (next/headers)
  requireUser(returnTo: string): Promise<AuthLiteUser>;      // нет входа → redirect(`/login?next=…`)
  withUser(handler: (req: Request, user: AuthLiteUser) => Response | Promise<Response>):
    (req: Request) => Promise<Response>;                     // нет входа → 401 {"error":"unauthorized"}
}
```

## `@ykurilov/authlite/hono`

```ts
mountAuthLite(app: Hono, authLite: AuthLite): void           // /api/auth/*
requireUser(authLite): MiddlewareHandler                     // 401 JSON; c.get("user")
requirePage(authLite): MiddlewareHandler                     // 302 на вход с ?next=; c.get("user")
getCurrentUser(authLite, c): Promise<AuthLiteUser | null>
```

## `@ykurilov/authlite/react` (+ `@ykurilov/authlite/styles.css`)

```tsx
<LoginScreen appName? logo? signUpHref="/signup" forgotPasswordHref="/forgot-password" defaultRedirect="/" />
<SignUpScreen appName? logo? loginHref="/login" defaultRedirect="/" />
<ForgotPasswordScreen appName? logo? loginHref="/login" resetPasswordPath="/reset-password" />
<ResetPasswordScreen appName? logo? loginHref="/login" forgotPasswordHref="/forgot-password" />
<SignOutButton redirectTo="/login">Выйти</SignOutButton>
useCurrentUser(): { user: AuthLiteUser | null; loading: boolean }
<AuthGuard loginHref="/login">{children}</AuthGuard>          // защита страниц в SPA
```

Все экраны: адрес возврата берут из `?next=` (только относительный путь внутри приложения).
Внешний вид — CSS-переменные: `--authlite-accent`, `--authlite-accent-text`, `--authlite-bg`,
`--authlite-surface`, `--authlite-text`, `--authlite-muted`, `--authlite-border`, `--authlite-error`,
`--authlite-radius`, `--authlite-font`. Тёмная тема — автоматически или `data-theme="dark"`.
