# Research: AuthLite v1

Сверено с документацией Better Auth v1.7.15 (context7) 2026-11-03.

## 1. Драйвер SQLite

- **Decision**: встроенный `node:sqlite` (`DatabaseSync`), Better Auth принимает его напрямую в `database`.
- **Rationale**: нет нативной сборки (better-sqlite3 требует компиляции и разрешения скриптов установки в pnpm) — меньше отказов при установке агентом, ноль зависимостей.
- **Alternatives**: `better-sqlite3` (быстрее, но нативный модуль), libsql (лишняя зависимость).

## 2. Создание и обновление таблиц

- **Decision**: `getMigrations(auth.options)` из `better-auth/db/migration` при первом обращении (`ready()`), один раз на процесс.
- **Rationale**: работает с встроенным адаптером Kysely для SQLite; после обновления Better Auth добавляет недостающие таблицы/колонки сам.
- **Alternatives**: CLI `@better-auth/cli migrate` — ручной шаг, против принципа IV.

## 3. Пароли, сессии, сброс

- **Decision**: `emailAndPassword: { enabled, minPasswordLength: 8, maxPasswordLength: 128, autoSignIn: true, resetPasswordTokenExpiresIn: 3600, revokeSessionsOnPasswordReset: true, sendResetPassword }`; `session: { expiresIn: 30 дней, updateAge: 1 день }`.
- **Rationale**: всё штатное. Ссылка одноразовая — Better Auth удаляет запись после использования. Ответ `/request-password-reset` одинаков для любых адресов.
- **«Работает только последняя ссылка»**: Better Auth этого не делает. В `sendResetPassword` удаляем прежние записи `reset-password:*` этого пользователя из таблицы `verification` (оставляем самую новую). Это не криптография — только удаление строк.

## 4. Ограничение частоты

- **Decision**: штатный `rateLimit` Better Auth, явно `enabled: true`, хранилище в памяти: `/sign-in/email` — 5 за 60 с; `/request-password-reset` — 3 за 600 с (по адресу подключения). Для порога «3 за 10 минут на email» — свой маленький счётчик в памяти перед отправкой письма (ответ при этом нейтральный).
- **Rationale**: Better Auth считает только по адресу подключения; счёт по email — 20 строк кода.
- **Note**: адрес подключения берётся из `x-forwarded-for`/`x-real-ip` (за обратным прокси) — описано в скилле.

## 5. Нормализация email

- **Decision**: хук `hooks.before` (`createAuthMiddleware`) обрезает пробелы и переводит в нижний регистр поле `email` для регистрации, входа и запроса сброса; экраны делают то же до отправки.

## 6. Почта

- **Decision**: интерфейс `EmailSender { send(message): Promise<void> }`. `createResendSender({ apiKey, from })` — `POST https://api.resend.com/emails`. Без `RESEND_API_KEY` — `createConsoleSender()` пишет ссылку в журнал и предупреждение при старте.
- **Ошибки отправки**: ловятся и пишутся в журнал (без пароля и токена-ссылки не прячем — ссылка в журнале только в режиме разработки), пользователь видит нейтральное сообщение.

## 7. Переходники

- **Next.js**: `toNextJsHandler` из `better-auth/next-js` для `app/api/auth/[...all]/route.ts`; защита страниц — `requireUser(returnTo)` в серверном компоненте (`redirect('/login?next=...')`), запросов — `withUser(handler)` → 401.
- **Hono**: `app.on(["GET","POST"], "/api/auth/*", c => auth.handler(c.req.raw))`; `requireUser()` (401 JSON), `requirePage()` (302 на вход с `next`).
- **Экраны**: React-компоненты без роутера, переходы обычными ссылками, запросы — `fetch` к `/api/auth/*` (без клиентской библиотеки Better Auth — меньше зависимостей, контракт из `contracts/http-endpoints.md`).

## 8. Темы и внешний вид

- **Decision**: CSS-переменные `--authlite-*`, светлая/тёмная по `prefers-color-scheme` и `data-theme`; название и логотип — свойства экранов `appName`, `logo`.

## 9. Сборка и установка пакета

- **Decision**: `tsc` в `dist/` + копирование `styles.css`. Примеры — `workspace:*`. Внешнее приложение до npm: `pnpm pack` → `pnpm add ./ykurilov-authlite-x.y.z.tgz`, либо git `github:<владелец>/<репо>#path:packages/authlite` (пакет собирается скриптом `prepare`). После публикации — `pnpm add @ykurilov/authlite`.

## 10. Версии

Next.js 16.4, React 19.3, Hono 4.13 + `@hono/node-server` 2.1, Vite 8.3, Vitest 5.1, Playwright 1.64, TypeScript 7.0.
