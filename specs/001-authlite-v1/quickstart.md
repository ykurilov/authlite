# Quickstart: проверка AuthLite v1

## Требования

Node.js ≥ 22.13, pnpm.

## Сборка и тесты

```bash
pnpm install
pnpm --filter @ykurilov/authlite build
pnpm test          # Vitest: ядро и переходники
pnpm e2e           # Playwright: истории 1–3 в обоих примерах
```

## Пример Next.js

```bash
cd examples/next-app
AUTHLITE_SECRET=$(openssl rand -base64 32) AUTHLITE_URL=http://localhost:3000 pnpm dev
```

## Пример Hono + Vite

```bash
cd examples/hono-vite
AUTHLITE_SECRET=$(openssl rand -base64 32) AUTHLITE_URL=http://localhost:5173 pnpm dev
```

## Ручная проверка (оба примера)

1. `/dashboard` без входа → перенаправление на `/login?next=/dashboard`.
2. «Зарегистрироваться» → новый email и пароль ≥ 8 → попадаем на `/dashboard`, видим email.
3. `GET /api/notes` без входа → 401; после входа → 200 с данными.
4. «Выйти» → `/dashboard` снова закрыт; вход с теми же данными работает.
5. «Забыли пароль?» → email → нейтральное сообщение; в журнале сервера строка со ссылкой
   (режим разработки) → новый пароль → вход с новым работает, со старым — нет.
6. Повторный переход по той же ссылке → «Ссылка устарела».
7. Запуск без `AUTHLITE_SECRET` → остановка с подсказкой, какую переменную задать.
