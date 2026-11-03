# AuthLite

Простая авторизация для приложений на **Next.js** и **Hono + Vite**: регистрация и вход по email и паролю,
выход, сессия на 30 дней, сброс пароля по ссылке из письма, защита страниц и API, ограничение частоты
попыток. Внутри — [Better Auth](https://better-auth.com) 1.7, данные — один файл SQLite, письма — Resend.
Готовые экраны на русском, светлая и тёмная тема, вид на телефоне.

Подключают его агенты по скиллу [skill/authlite/SKILL.md](skill/authlite/SKILL.md).

## Быстрый старт в своём приложении

```bash
pnpm add @ykurilov/authlite        # способы установки (локально, git, npm) — в скилле
```

```bash
AUTHLITE_SECRET=$(openssl rand -base64 32)   # обязательно, ≥ 32 символов
AUTHLITE_URL=http://localhost:3000           # обязательно, адрес приложения
RESEND_API_KEY=...                           # необязательно; без него ссылки сброса пишутся в журнал
AUTHLITE_EMAIL_FROM="Заметки <noreply@example.com>"  # нужно вместе с RESEND_API_KEY
```

```ts
import { createAuthLite } from "@ykurilov/authlite";
export const authLite = createAuthLite(); // всё остальное — из переменных окружения
```

Дальше — переходник для Next.js (`@ykurilov/authlite/next`) или Hono (`@ykurilov/authlite/hono`),
экраны из `@ykurilov/authlite/react` и стили `@ykurilov/authlite/styles.css`. Пошагово — в скилле.

## Структура

```
packages/authlite/      библиотека @ykurilov/authlite
  src/core/             настройки, база SQLite, письма, ограничения, createAuthLite
  src/next/  src/hono/  переходники
  src/react/            экраны, кнопка выхода, AuthGuard, styles.css
  tests/                тесты Vitest
examples/next-app/      пример на Next.js 16
examples/hono-vite/     пример на Hono + Vite + React
e2e/                    сквозные тесты Playwright для обоих примеров
skill/authlite/         скилл для агентов
specs/001-authlite-v1/  спецификация, план, задачи
```

## Запуск примеров

Нужны Node.js ≥ 22.18 и pnpm.

```bash
pnpm install && pnpm build          # собрать библиотеку

cd examples/next-app
AUTHLITE_SECRET=$(openssl rand -base64 32) AUTHLITE_URL=http://localhost:3000 pnpm dev
# открыть http://localhost:3000

cd examples/hono-vite
AUTHLITE_SECRET=$(openssl rand -base64 32) AUTHLITE_URL=http://localhost:5173 pnpm dev
# открыть http://localhost:5173
```

Рабочий режим: `pnpm build && pnpm start` в папке примера (те же переменные; Hono — порт из `PORT`,
по умолчанию 5173). Без `RESEND_API_KEY` ссылка сброса пароля появляется в журнале сервера.
Секрет лучше положить в `.env` по образцу `.env.example` (Next.js читает его сам; для Hono —
`node --env-file=.env server/dev.ts`).

## Тесты

```bash
pnpm test     # Vitest: ядро, переходники, сброс пароля, ограничения — 62 теста
pnpm e2e      # сборка + Playwright: истории 1–3 в обоих примерах и снимки экрана входа
```

## Замер (iMac M1, Node 24, пример Hono)

Скрипт: `node --expose-gc examples/hono-vite/server/measure.ts baseline|idle|authlite`.

| Что | Результат |
|---|---|
| Регистрация (ответ сервера) | медиана 65–125 мс, максимум 340 мс |
| Вход | медиана 65–130 мс, максимум 170 мс |
| Память кучи JavaScript | +11 МБ после запуска, +13 МБ после 20 входов и регистраций |
| Память процесса (RSS) | +43 МБ после запуска, +45…85 МБ после 20 входов и регистраций |

Время почти целиком уходит на хеширование пароля (scrypt) — так и задумано, это защита от подбора.
Цель «быстрее 1 секунды» выполняется с большим запасом; на слабом сервере с одним процессором
ожидается в несколько раз медленнее, но в пределах цели — проверить на сервере.

Цель «не больше 30 МБ памяти» по памяти процесса **не выполнена**: основную часть даёт загрузка
кода Better Auth (≈ 40 МБ), ещё часть — буферы хеширования, которые система держит про запас.
Куча JavaScript растёт на 11–13 МБ.

## Ограничения

- Один процесс приложения: счётчики попыток живут в памяти и обнуляются при перезапуске.
- За nginx нужен `proxy_set_header X-Forwarded-For $remote_addr;` — иначе лимит по адресу можно обойти.
- Только email и пароль: без входа через соцсети, подтверждения почты и двухфакторной защиты.
