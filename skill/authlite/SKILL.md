---
name: authlite
description: Подключить AuthLite — простую авторизацию (email и пароль, выход, сброс пароля по почте, защита страниц и API) поверх Better Auth — в приложение Юрия на Next.js или Hono + Vite. Использовать, когда приложению нужны регистрация и вход «своими силами», без внешнего сервиса входа, а также при словах AuthLite, @ykurilov/authlite, «простая авторизация», «вход по email и паролю».
---

# AuthLite: подключение в приложение

AuthLite — пакет `@ykurilov/authlite`. Даёт регистрацию, вход, выход, сессию на 30 дней, сброс пароля
по ссылке из письма, ограничение частоты попыток и готовые русские экраны. Данные — один файл SQLite.
Письма — через Resend; без ключа включается режим разработки: ссылка сброса пишется в журнал сервера.

Требования: Node.js ≥ 22.13 (для Hono-сервера, который запускает `.ts` напрямую, — ≥ 22.18), pnpm,
React ≥ 18. Next.js ≥ 15 или Hono ≥ 4 с Vite.

## 1. Установка

Выбрать один способ.

**Локально из папки с исходниками** (репозиторий AuthLite лежит на этом же компьютере):

```bash
cd "<папка AuthLite>/packages/authlite" && pnpm install && pnpm pack --pack-destination /tmp
cd "<папка приложения>" && pnpm add /tmp/ykurilov-authlite-0.1.0.tgz
```

Архив содержит собранный код (`dist`). Номер версии в имени архива — из `package.json` библиотеки;
команда `pnpm pack` печатает точное имя. Если приложение будут собирать на другом компьютере или
сервере — положить архив внутрь приложения (например `vendor/`) и ставить оттуда:
`pnpm add ./vendor/ykurilov-authlite-<версия>.tgz`. После правок библиотеки повторить установку.

**Из git** (когда репозиторий AuthLite выложен): пакет лежит в подпапке, сборка запускается сама
скриптом `prepare`:

```bash
pnpm add "@ykurilov/authlite@git+https://<git-адрес-репозитория>.git#path:packages/authlite"
```

**Из npm** (когда пакет опубликован): `pnpm add @ykurilov/authlite`.

Проверка: `node -e "import('@ykurilov/authlite').then(m => console.log(Object.keys(m)))"` из папки
приложения печатает `createAuthLite`.

## 2. Переменные окружения

| Переменная | Обязательна | Что это |
|---|---|---|
| `AUTHLITE_SECRET` | да | случайная строка ≥ 32 символов: `openssl rand -base64 32` |
| `AUTHLITE_URL` | да | адрес, по которому открывают приложение, например `https://app.example.com`; локально — с тем же портом, что в браузере |
| `RESEND_API_KEY` | нет | ключ Resend; без него — режим разработки |
| `AUTHLITE_EMAIL_FROM` | с ключом Resend | отправитель, например `Заметки <noreply@example.com>`; домен подтверждён в Resend |
| `AUTHLITE_APP_NAME` | нет | название в письмах, по умолчанию «Приложение»; на экранах название задаёт свойство `appName` — указать одинаково |
| `AUTHLITE_DB_PATH` | нет | файл базы, по умолчанию `./data/authlite.sqlite` от папки запуска |

Секреты — только в `.env` или окружении сервера, не в коде и не в git. В `.gitignore` приложения
добавить `data/` и `.env*`. Таблицы создаются сами при первом запуске.

Те же значения можно передать в `createAuthLite({ secret, baseURL, databasePath, appName, email: { from, sender } })`.
`email.sender` — свой отправитель писем: объект с методом `send({ to, subject, html, text })`.

## 3. Next.js (App Router)

`lib/auth.ts`:

```ts
import { createAuthLite } from "@ykurilov/authlite";
import { createNextAuth } from "@ykurilov/authlite/next";

export const authLite = createAuthLite();
export const nextAuth = createNextAuth(authLite);
```

`app/api/auth/[...all]/route.ts`:

```ts
import { nextAuth } from "@/lib/auth";
export const { GET, POST } = nextAuth.handlers;
```

`instrumentation.ts` в корне — без него ошибка настройки всплывёт только на первом запросе:

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { nextAuth } = await import("./lib/auth");
    await nextAuth.startup(); // нет секрета → понятная ошибка и остановка процесса
  }
}
```

Экраны — по странице на каждый, например `app/login/page.tsx`:

```tsx
import { LoginScreen } from "@ykurilov/authlite/react";
export default function LoginPage() {
  return <LoginScreen appName="Заметки" defaultRedirect="/dashboard" />;
}
```

Так же `app/signup/page.tsx` (`SignUpScreen`), `app/forgot-password/page.tsx` (`ForgotPasswordScreen`),
`app/reset-password/page.tsx` (`ResetPasswordScreen`). Стили — один раз в `app/layout.tsx`:
`import "@ykurilov/authlite/styles.css";`.

Защита:

```tsx
// Серверная страница: без входа — переход на /login?next=/dashboard
const user = await nextAuth.requireUser("/dashboard");

// Где вход необязателен
const user = await nextAuth.getCurrentUser(); // { id, email, name } или null

// API: без входа — 401 {"error":"unauthorized"}
export const GET = nextAuth.withUser(async (request, user) => Response.json({ owner: user.email }));
```

Кнопка выхода: `<SignOutButton />` из `@ykurilov/authlite/react` (после выхода ведёт на `/login`).

## 4. Hono + Vite

Сервер (`server/app.ts`):

```ts
import { createAuthLite } from "@ykurilov/authlite";
import { mountAuthLite, requireUser, type AuthLiteVariables } from "@ykurilov/authlite/hono";
import { Hono } from "hono";

export const authLite = createAuthLite();
export const app = new Hono<{ Variables: AuthLiteVariables }>();
mountAuthLite(app, authLite); // все /api/auth/*

app.get("/api/notes", requireUser(authLite), (c) => c.json({ owner: c.get("user").email }));
```

При старте сервера вызвать `await authLite.ready()` и при ошибке завершить процесс с её текстом —
так нехватка секрета видна сразу.

Страницы и API должны жить на одном адресе (cookie сессии привязана к нему):

- разработка — один процесс: Node-сервер отдаёт `/api/*` в Hono через `getRequestListener(app.fetch)`
  из `@hono/node-server`, остальное — в Vite в `middlewareMode`;
- рабочий режим — Hono отдаёт собранные `dist` и защищает страницы на сервере. Порядок маршрутов
  важен: сначала API (`mountAuthLite` и свои `/api/*`), затем файлы, защищённые страницы, остальное:

```ts
import { readFileSync } from "node:fs";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { requirePage } from "@ykurilov/authlite/hono";

const indexHtml = readFileSync("./dist/index.html", "utf8");
app.use("/assets/*", serveStatic({ root: "./dist" }));
app.get("/dashboard", requirePage(authLite), (c) => c.html(indexHtml)); // без входа — 302 на /login?next=
app.get("*", (c) => c.html(indexHtml));
serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) });
```

Вместо одного процесса годится и прокси Vite (`server.proxy: { "/api": "http://localhost:<порт Hono>" }`),
тогда `AUTHLITE_URL` — адрес Vite.

Клиент (React): экраны те же, что в Next.js, — показывать по адресам `/login`, `/signup`,
`/forgot-password`, `/reset-password`. Стили: `import "@ykurilov/authlite/styles.css";`. Чтобы
TypeScript принял импорт CSS, в проекте нужен `src/vite-env.d.ts` со строкой
`/// <reference types="vite/client" />` (шаблон Vite его создаёт).
Защита страницы в браузере:

```tsx
import { AuthGuard, useCurrentUser } from "@ykurilov/authlite/react";

<AuthGuard fallback={<p>Загрузка…</p>}>{(user) => <Dashboard email={user.email} />}</AuthGuard>
```

`AuthGuard` без входа ведёт на `/login?next=<текущий путь>`. Данные всё равно закрывать на сервере
через `requireUser`.

## 5. Экраны и внешний вид

Свойства экранов (все необязательные; у всех есть `appName` и `logo` — React-элемент):

| Экран | Свои свойства и значения по умолчанию |
|---|---|
| `LoginScreen` | `signUpHref="/signup"`, `forgotPasswordHref="/forgot-password"`, `defaultRedirect="/"` |
| `SignUpScreen` | `loginHref="/login"`, `defaultRedirect="/"` |
| `ForgotPasswordScreen` | `loginHref="/login"`, `resetPasswordPath="/reset-password"` |
| `ResetPasswordScreen` | `loginHref="/login"`, `forgotPasswordHref="/forgot-password"` |
| `SignOutButton` | `redirectTo="/login"`, текст кнопки — `children` (по умолчанию «Выйти») |

`defaultRedirect` — куда вести после входа, если в адресе нет `?next=`.
Адрес возврата `?next=` принимается только относительный, внутри приложения.

Если экраны лежат не по стандартным адресам — передать `routes: { login, resetPassword }` в
`createAuthLite` и те же адреса в свойства экранов.

Цвета и форма меняются CSS-переменными на `:root`: `--authlite-accent`, `--authlite-accent-text`,
`--authlite-bg`, `--authlite-surface`, `--authlite-text`, `--authlite-muted`, `--authlite-border`,
`--authlite-error`, `--authlite-success`, `--authlite-radius`, `--authlite-font`. Тёмная тема включается
сама по настройке системы или атрибутом `data-theme="dark"` на `<html>`; `data-theme="light"` — всегда
светлая. Для тёмной темы задать отдельный, более светлый акцент в `@media (prefers-color-scheme: dark)`.

## 6. Сервер за nginx

Ограничение частоты (5 попыток входа в минуту, 3 запроса сброса за 10 минут) считает попытки по
адресу из заголовка `X-Forwarded-For`. nginx должен перезаписывать его, а не дописывать:

```nginx
proxy_set_header X-Forwarded-For $remote_addr;
proxy_set_header Host $host;
```

Иначе посетитель подставит любой адрес и обойдёт лимит. Отдельно действует лимит 3 письма сброса
за 10 минут на один email — он не зависит от адреса.

Счётчики живут в памяти: при перезапуске обнуляются. Один процесс приложения — без кластера.
Файл базы и папка над ним должны быть доступны процессу на запись; в Docker — вынести в том
(`AUTHLITE_DB_PATH=/data/authlite.sqlite`).

## 7. Проверка

Адреса API (все под `/api/auth`, JSON, для запросов не из браузера нужен заголовок
`Origin: <AUTHLITE_URL>`):

| Запрос | Тело |
|---|---|
| `POST /sign-up/email` | `{ email, password, name }` |
| `POST /sign-in/email` | `{ email, password, rememberMe: true }` |
| `POST /sign-out` | `{}` |
| `GET /get-session` | — |
| `POST /request-password-reset` | `{ email, redirectTo: "/reset-password" }` |
| `POST /reset-password` | `{ token, newPassword }` |

Ссылка из письма ведёт на `/api/auth/reset-password/<токен>?callbackURL=…`, а оттуда — на экран
`/reset-password?token=…`, либо на `/reset-password?error=INVALID_TOKEN`, если ссылка устарела.

1. Запустить без `AUTHLITE_SECRET` — процесс останавливается с подсказкой, что задать
   (Next.js успевает напечатать «Ready», затем `startup()` завершает процесс с кодом 1).
2. `/dashboard` без входа → `/login?next=%2Fdashboard`; `GET /api/notes` → 401.
3. Регистрация → попадание на защищённую страницу, виден email.
4. «Выйти» → защищённая страница снова закрыта; вход с теми же данными работает.
5. «Забыли пароль?» → email → нейтральное сообщение. Без `RESEND_API_KEY` в журнале сервера строка
   `[AuthLite] Режим разработки — письмо не отправлено` со ссылкой. Ссылка → новый пароль → вход
   с новым работает, со старым — нет; повторный переход по ссылке → «Ссылка устарела».

## Частые ошибки

| Признак | Причина и решение |
|---|---|
| `[AuthLite] Не задан секрет сессий…` или `AUTHLITE_SECRET слишком короткий` | задать переменную, ≥ 32 символов |
| `[AuthLite] Не задан адрес приложения` | задать `AUTHLITE_URL` |
| `Нет права записи в файл базы …` | права на папку или `AUTHLITE_DB_PATH` в доступное место |
| 403 `Invalid origin` на входе | `AUTHLITE_URL` не совпадает с адресом в браузере (порт, http/https); другие адреса — `trustedOrigins` |
| Вход проходит, но страница снова просит войти | API и страницы на разных адресах — cookie не доходит; свести на один адрес (п. 4) |
| Письмо не пришло | без `RESEND_API_KEY` письма не уходят (смотреть журнал); с ключом — проверить домен отправителя в Resend и журнал на `Не удалось отправить письмо` |
| `Cannot find module 'node:sqlite'` | Node.js старше 22.13 — обновить |
| Next.js: `next/headers` вне запроса | `getCurrentUser`/`requireUser` из `nextAuth` — только в серверных компонентах, обработчиках и действиях |
| Локально в журнале `Rate limiting could not determine a client IP…`, а попытки входа быстро дают 429 | без nginx у запросов нет адреса, и счётчик общий на всех — для разработки это нормально; подождать минуту. На сервере исчезает после настройки nginx (п. 6) |
