# Implementation Plan: AuthLite v1

**Branch**: `main` (фича `001-authlite-v1`) | **Date**: 2026-11-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-authlite-v1/spec.md`

## Summary

AuthLite — пакет `@ykurilov/authlite`: одна функция `createAuthLite()` настраивает Better Auth 1.7
(email + пароль, сессии 30 дней, сброс по одноразовой ссылке, ограничение частоты, телеметрия выключена)
поверх одного файла SQLite (встроенный в Node модуль `node:sqlite`). Таблицы создаются при первом
обращении программными миграциями Better Auth. Письма — через интерфейс `EmailSender`; по умолчанию
Resend по HTTP, без ключа — режим разработки со ссылкой в журнале. Поверх ядра — два тонких переходника
(`/next`, `/hono`) и готовые экраны на React (`/react`) с темами через CSS-переменные.
В репозитории — два примера (Next.js и Hono + Vite), скилл для агентов и README.

## Technical Context

**Language/Version**: TypeScript (ESM), Node.js ≥ 22.13 (нужен `node:sqlite` без флага)

**Primary Dependencies**: `better-auth@1.7.15` (единственная зависимость рантайма). Peer (необязательные):
`react`, `next`, `hono`.

**Storage**: один файл SQLite (`./data/authlite.sqlite` по умолчанию) через `node:sqlite` `DatabaseSync`

**Testing**: Vitest (ядро и переходники через настоящие `Request`/`Response`), Playwright (сквозные
сценарии историй 1–3 в обоих примерах, один прогон). Запуск — на iMac через `imac-run`.

**Target Platform**: Linux/macOS сервер с Node.js; браузеры — современные, телефон

**Project Type**: библиотека (монорепозиторий pnpm: пакет + 2 примера)

**Performance Goals**: вход/регистрация < 1 с на 1 vCPU/1 ГБ (хэш scrypt Better Auth ~50–100 мс)

**Constraints**: +≤30 МБ памяти; без нативных модулей и фоновых процессов; без SMTP

**Scale/Scope**: одно приложение на одном сервере; до тысяч пользователей

## Constitution Check

| Принцип | Как выполняется | Статус |
|---|---|---|
| I. Лёгкость | Одна зависимость рантайма (`better-auth`); SQLite встроен в Node — без нативной сборки; телеметрия выключена явно; всё внутри приложения | ✅ |
| II. Безопасность не изобретаем | Пароли, сессии, токены — Better Auth; нейтральный ответ на сброс — его же; свой код только удаляет старые ссылки сброса и считает частоту по email | ✅ |
| III. Подключение агентом | `createAuthLite()` + переходник + 4 экрана; скилл `skill/authlite/SKILL.md` с проверкой | ✅ |
| IV. SQLite одним файлом | `node:sqlite`, миграции `getMigrations` при первом обращении | ✅ |
| V. Почта без SMTP | `EmailSender`; `createResendSender` (fetch), `createConsoleSender` (режим разработки) | ✅ |
| VI. Модульность | `core/` (ядро), `next/`, `hono/`, `react/` — отдельные модули; наружу — по 2–4 функции | ✅ |
| VII. Тесты по делу | TDD для ядра и переходников; e2e — только сквозные сценарии; часы подменяются в тестах срока ссылки | ✅ |

Технические рамки: TypeScript, pnpm, один замок; секреты только из окружения; документы на русском. ✅

Повторная проверка после проектирования: нарушений нет, таблица сложности не нужна.

## Project Structure

### Documentation (this feature)

```text
specs/001-authlite-v1/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── library-api.md     # публичные функции пакета
│   └── http-endpoints.md  # адреса /api/auth/* и экраны
└── tasks.md
```

### Source Code (repository root)

```text
packages/authlite/
├── src/
│   ├── core/
│   │   ├── create-auth-lite.ts      # createAuthLite(): сборка Better Auth, ready(), getCurrentUser()
│   │   ├── settings.ts              # чтение окружения, значения по умолчанию, понятные ошибки
│   │   ├── database.ts              # открытие файла SQLite, проверка записи
│   │   ├── reset-request-limiter.ts # 3 запроса сброса за 10 минут на email
│   │   └── email/
│   │       ├── email-sender.ts      # интерфейс EmailSender
│   │       ├── resend-sender.ts
│   │       ├── console-sender.ts
│   │       └── reset-password-email.ts
│   ├── next/index.ts                # createNextAuth(): обработчики, requireUser, withUser
│   ├── hono/index.ts                # mountAuthLite(), requireUser(), requirePage()
│   ├── react/                       # LoginScreen, SignUpScreen, ForgotPasswordScreen,
│   │   │                            # ResetPasswordScreen, SignOutButton, useCurrentUser, AuthGuard
│   │   └── styles.css
│   └── index.ts
└── tests/                           # Vitest
examples/
├── next-app/                        # Next.js App Router
└── hono-vite/                       # Hono (сервер) + Vite React (экраны)
e2e/                                 # Playwright: истории 1–3 для обоих примеров
skill/authlite/SKILL.md
README.md
```

**Structure Decision**: монорепозиторий pnpm (`packages/*`, `examples/*`). Пакет собирается `tsc` в `dist/`;
примеры ставят его как `workspace:*`. Внешние приложения до публикации — из архива `pnpm pack`
или из git; после — из npm (оба пути в скилле).

## Complexity Tracking

Нарушений конституции нет.
