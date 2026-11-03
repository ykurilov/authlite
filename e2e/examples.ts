import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface E2EExample {
  name: string;
  baseURL: string;
  /** Папка примера и команда запуска в рабочем режиме. */
  dir: string;
  start: string;
}

const ROOT = join(import.meta.dirname, "..");
const RUN_DIR = join(ROOT, ".e2e-run");
const SECRET = "e2e-secret-e2e-secret-e2e-secret-e2e-123";

export const E2E_EXAMPLES: E2EExample[] = [
  { name: "next", baseURL: "http://localhost:3100", dir: "examples/next-app", start: "pnpm exec next start --port 3100" },
  { name: "hono", baseURL: "http://localhost:3200", dir: "examples/hono-vite", start: "PORT=3200 node server/prod.ts" },
];

/**
 * Сервер примера с чистой базой, без RESEND_API_KEY (режим разработки: ссылки сброса пишутся в журнал).
 * Журнал сервера пишется в файл — из него тест берёт ссылку из «письма».
 */
export function serverCommand(example: E2EExample): string {
  const runDir = join(RUN_DIR, example.name);
  const env = [
    `AUTHLITE_SECRET=${SECRET}`,
    `AUTHLITE_URL=${example.baseURL}`,
    `AUTHLITE_DB_PATH='${join(runDir, "auth.sqlite")}'`,
    "RESEND_API_KEY=",
  ].join(" ");
  return `rm -rf '${runDir}' && mkdir -p '${runDir}' && cd '${join(ROOT, example.dir)}' && ${env} ${example.start} > '${serverLogPath(example)}' 2>&1`;
}

export function serverLogPath(example: E2EExample): string {
  return join(RUN_DIR, `${example.name}.log`);
}

/** Последняя ссылка сброса для адреса из журнала сервера (режим разработки). */
export function lastResetLinkFor(example: E2EExample, email: string): string | null {
  const log = readFileSync(serverLogPath(example), "utf8");
  const letters = log.split("[AuthLite] Режим разработки — письмо не отправлено.").filter((letter) => letter.includes(`Кому: ${email}.`));
  const letter = letters.at(-1);
  return letter ? (/(https?:\/\/\S+\/api\/auth\/reset-password\/\S+)/.exec(letter)?.[1] ?? null) : null;
}

export function exampleByName(name: string): E2EExample {
  const example = E2E_EXAMPLES.find((candidate) => candidate.name === name);
  if (!example) throw new Error(`Нет примера ${name}`);
  return example;
}
