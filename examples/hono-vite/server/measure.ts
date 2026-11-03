// Замер для README: память, которую добавляет AuthLite, и время ответа входа и регистрации.
// Запуск: node --expose-gc server/measure.ts baseline | authlite
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";

const mode = process.argv[2] ?? "authlite";
const BASE = "http://localhost:5173";
const gc = (globalThis as { gc?: () => void }).gc!;
const app = new Hono();
app.get("/api/ping", (c) => c.json({ ok: true }));

async function call(path: string, body?: unknown, ip = "10.0.0.1") {
  const headers = new Headers({ origin: BASE, "x-forwarded-for": ip });
  if (body) headers.set("content-type", "application/json");
  return app.fetch(new Request(BASE + path, { method: body ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : undefined }));
}

const timings: Record<string, number[]> = { "регистрация": [], "вход": [] };

if (mode === "authlite" || mode === "idle") {
  const { createAuthLite } = await import("@ykurilov/authlite");
  const { mountAuthLite } = await import("@ykurilov/authlite/hono");
  const authLite = createAuthLite({
    secret: "measure-secret-measure-secret-measure-1",
    baseURL: BASE,
    databasePath: join(mkdtempSync(join(tmpdir(), "authlite-measure-")), "auth.sqlite"),
    email: { sender: { send: async () => {} } },
  });
  mountAuthLite(app, authLite);
  await authLite.ready();
  for (let index = 0; index < 20; index += 1) await call("/api/ping");
  for (let index = 0; index < (mode === "idle" ? 0 : 10); index += 1) {
    const email = `user${index}@example.com`;
    const ip = `10.1.0.${index}`;
    let start = performance.now();
    const signUp = await call("/api/auth/sign-up/email", { email, password: "password-12345", name: "" }, ip);
    timings["регистрация"]!.push(performance.now() - start);
    start = performance.now();
    const signIn = await call("/api/auth/sign-in/email", { email, password: "password-12345" }, ip);
    timings["вход"]!.push(performance.now() - start);
    if (signUp.status !== 200 || signIn.status !== 200) throw new Error(`статусы ${signUp.status}/${signIn.status}`);
  }
}

if (mode === "baseline") for (let index = 0; index < 20; index += 1) await call("/api/ping");
for (let index = 0; index < 3; index += 1) gc();
await new Promise((resolve) => setTimeout(resolve, 2000));
gc();
const memory = process.memoryUsage();
const rssMb = memory.rss / 1024 / 1024;
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
const result: Record<string, string> = { mode, rssMb: rssMb.toFixed(1), heapUsedMb: mb(memory.heapUsed), externalMb: mb(memory.external) };
for (const [name, values] of Object.entries(timings)) if (values.length) result[name] = `медиана ${median(values).toFixed(0)} мс, макс ${Math.max(...values).toFixed(0)} мс`;
console.log(JSON.stringify(result));
