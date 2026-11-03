---
description: "Задачи реализации AuthLite v1"
---

# Tasks: AuthLite v1

**Input**: `specs/001-authlite-v1/` — plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: TDD по конституции (принцип VII): тесты ядра и переходников пишутся до кода и должны быть
красными по нужной причине. Браузерные — только сквозные сценарии историй 1–3, один прогон.

## Phase 1: Setup

- [X] T001 Создать корень монорепозитория: `package.json` (скрипты build/test/e2e), `pnpm-workspace.yaml` (`packages/*`, `examples/*`), `.gitignore`, `.nvmrc` (22), `tsconfig.base.json`
- [X] T002 Создать пакет `packages/authlite/package.json` (`@ykurilov/authlite`, exports `.`/`./next`/`./hono`/`./react`/`./styles.css`, зависимость `better-auth@1.7.15`, peer react/next/hono необязательные, скрипты build/test/prepare), `packages/authlite/tsconfig.json`, `packages/authlite/vitest.config.ts`
- [X] T003 Установить зависимости `pnpm install`, закоммитить `pnpm-lock.yaml`

## Phase 2: Foundational

- [X] T004 [P] Тесты настроек в `packages/authlite/tests/settings.test.ts`: нет секрета → `AuthLiteConfigError` с именем `AUTHLITE_SECRET` и командой генерации; секрет < 32 символов → ошибка; нет `AUTHLITE_URL` → ошибка; без `RESEND_API_KEY` — режим разработки; с ключом без `AUTHLITE_EMAIL_FROM` → ошибка
- [X] T005 [P] Тесты базы в `packages/authlite/tests/database.test.ts`: файл и папка создаются; папка без права записи → `AuthLiteConfigError` с путём
- [X] T006 Реализовать `packages/authlite/src/core/settings.ts` и `packages/authlite/src/core/errors.ts`
- [X] T007 Реализовать `packages/authlite/src/core/database.ts` (`node:sqlite`, проверка записи)
- [X] T008 [P] Тесты почты в `packages/authlite/tests/email.test.ts`: Resend шлёт `POST https://api.resend.com/emails` с `Authorization: Bearer`, from/to/subject/html/text; ошибка HTTP → исключение; консольный отправитель пишет ссылку; письмо сброса — русский текст с названием приложения и ссылкой
- [X] T009 Реализовать `packages/authlite/src/core/email/{email-sender,resend-sender,console-sender,reset-password-email}.ts`

## Phase 3: User Story 1 — Регистрация, вход, выход (P1) 🎯 MVP

**Goal**: регистрация, вход, выход, сессия 30 дней. **Independent Test**: через `handler` зарегистрироваться, выйти, войти; cookie сессии постоянная (Max-Age ≈ 30 дней).

- [X] T010 [US1] Тесты в `packages/authlite/tests/sign-in-flow.test.ts`: регистрация → 200 и cookie; повторный email (в т.ч. `"  User@Example.COM "`) → отказ, запись не изменена; пароль 7 и 129 символов → отказ; вход верный → 200; неверный → 401; выход → сессия закрыта; Max-Age cookie 30 дней; таблицы созданы автоматически при первом запросе; телеметрия выключена в опциях
- [X] T011 [US1] Реализовать `packages/authlite/src/core/create-auth-lite.ts` (Better Auth: emailAndPassword 8–128, autoSignIn, session 30 дней/1 день, telemetry off, хук нормализации email, `ready()` с `getMigrations`) и `packages/authlite/src/index.ts`
- [X] T012 [P] [US1] Экраны `packages/authlite/src/react/{auth-api,form-fields,login-screen,sign-up-screen,sign-out-button}.tsx` и `packages/authlite/src/react/styles.css` (CSS-переменные, тёмная тема, телефон); проверка длины пароля и пустых полей до отправки; тексты из `contracts/http-endpoints.md`
- [X] T013 [P] [US1] Тест `packages/authlite/tests/react-helpers.test.ts`: `safeReturnPath` пропускает только относительные пути, `validatePassword`, нормализация email

## Phase 4: User Story 2 — Защита страниц и данных (P1)

**Goal**: приложение знает пользователя и закрывает страницы/запросы. **Independent Test**: защищённый запрос без входа → 401, после входа → данные; страница без входа → редирект с `next`.

- [X] T014 [P] [US2] Тесты `packages/authlite/tests/current-user.test.ts`: `getCurrentUser` → `{id,email,name}` / `null`; после выхода в другой вкладке → `null`
- [X] T015 [P] [US2] Тесты `packages/authlite/tests/hono-adapter.test.ts`: `mountAuthLite`, `requireUser` (401 `{"error":"unauthorized"}` / пользователь в `c.get("user")`), `requirePage` (302 на `/login?next=<путь>`)
- [X] T016 [P] [US2] Тесты `packages/authlite/tests/next-adapter.test.ts`: `handlers.GET/POST` проксируют, `withUser` 401/200, `requireUser` вызывает `redirect("/login?next=…")` (мок `next/navigation`, `next/headers`)
- [X] T017 [US2] Реализовать `getCurrentUser` в `packages/authlite/src/core/create-auth-lite.ts`
- [X] T018 [P] [US2] Реализовать `packages/authlite/src/hono/index.ts`
- [X] T019 [P] [US2] Реализовать `packages/authlite/src/next/index.ts`
- [X] T020 [P] [US2] Реализовать `useCurrentUser` и `AuthGuard` в `packages/authlite/src/react/current-user.tsx`
- [X] T021 [US2] Пример `examples/next-app` (Next.js 16): `/api/auth/[...all]`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, защищённая `/dashboard`, защищённый `/api/notes`, `lib/auth.ts`
- [X] T022 [US2] Пример `examples/hono-vite` (Hono сервер + Vite React): те же экраны и адреса, `requireUser` на `/api/notes`, `AuthGuard` на `/dashboard`, в рабочем режиме Hono отдаёт сборку и `requirePage` на `/dashboard`

## Phase 5: User Story 3 — Сброс пароля (P2)

**Goal**: сброс по одноразовой ссылке на 1 час. **Independent Test**: в режиме разработки взять ссылку из журнала, задать новый пароль, войти; старый не работает.

- [X] T023 [US3] Тесты `packages/authlite/tests/password-reset.test.ts`: зарегистрированный email → письмо со ссылкой, ответ одинаков для незарегистрированного (письма нет); ссылка → новый пароль → старые сессии закрыты, старый пароль не работает, новый работает; повторное использование → `INVALID_TOKEN`; две ссылки подряд — работает только последняя; истёкшая через 1 час (подменённые часы) → `INVALID_TOKEN`; ошибка почтового сервиса → тот же ответ и запись в журнале; пароль не встречается в письмах, журналах и ответах (SC-006)
- [X] T024 [US3] Реализовать `sendResetPassword`, удаление прежних ссылок, `revokeSessionsOnPasswordReset`, срок 3600 с в `packages/authlite/src/core/create-auth-lite.ts` и `packages/authlite/src/core/reset-links.ts`
- [X] T025 [P] [US3] Экраны `packages/authlite/src/react/{forgot-password-screen,reset-password-screen}.tsx`: нейтральное сообщение; «Ссылка устарела» + «Запросить новую»; после сброса — выход текущей сессии и переход на вход
- [X] T026 [US3] Подключить экраны сброса в оба примера

## Phase 6: User Story 4 — Подключение агентом (P2)

**Goal**: скилл и документация. **Independent Test**: по скиллу подключить в чистое приложение — сценарии 1–3 проходят.

- [ ] T027 [US4] Скилл `skill/authlite/SKILL.md`: установка (локально через `pnpm pack`, из git, из npm), переменные окружения, Next.js и Hono + Vite пошагово, экраны, защита, внешний вид, проверка, частые ошибки
- [ ] T028 [P] [US4] `README.md` на русском: что это, быстрый старт, структура, запуск примеров, тесты
- [ ] T029 [US4] Проверка скилла на чистом приложении (свежий агент или ручной проход по шагам) — без правок кода библиотеки

## Phase 7: User Story 5 — Защита от перебора (P3)

**Goal**: ограничение частоты. **Independent Test**: 6-я попытка входа за минуту → 429; 4-й запрос сброса на email за 10 минут → письмо не уходит.

- [X] T030 [US5] Тесты `packages/authlite/tests/rate-limit.test.ts`: 6-я попытка входа за 60 с с одного адреса → 429; 4-й запрос сброса за 600 с с одного адреса → без письма; 4-й запрос на один email с разных адресов → без письма, ответ нейтральный; через 10 минут (подменённые часы) снова можно
- [X] T031 [US5] Реализовать `rateLimit` (enabled, memory, customRules) в `packages/authlite/src/core/create-auth-lite.ts` и `packages/authlite/src/core/reset-request-limiter.ts`; экран входа показывает «Слишком много попыток, попробуйте позже» на 429

## Phase 8: Polish

- [ ] T032 Сквозные тесты `e2e/auth-flows.spec.ts` + `playwright.config.ts`: истории 1–3 в обоих примерах (регистрация, выход, вход, перезапуск браузера с сохранённым состоянием, защищённая страница с возвратом, сброс по ссылке из журнала); снимки экрана входа в светлой и тёмной теме и на телефоне
- [ ] T033 Полный прогон всех тестов и сборки обоих примеров на iMac
- [ ] T034 Проверка памяти (SC-005) и скорости входа (SC-004) — короткий замер, результат в README

## Dependencies

Setup → Foundational → US1 → US2 → (US3, US5 параллельно) → US4 → Polish.
US2 зависит от ядра US1; примеры (T021, T022) нужны US3 и e2e.

## Parallel Examples

- Foundational: T004, T005, T008 — разные файлы.
- US2: T015/T016 и T018/T019/T020 — разные модули.
- US3 и US5 — после US2, разные файлы кроме `create-auth-lite.ts` (правки по очереди).

## Implementation Strategy

MVP — US1 + US2 (вход и защита в обоих примерах). Затем сброс, частота, скилл, e2e.
Коммит после каждой фазы.
