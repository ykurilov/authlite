import { createAuthLite } from "@ykurilov/authlite";
import { mountAuthLite, requireUser, type AuthLiteVariables } from "@ykurilov/authlite/hono";
import { Hono } from "hono";

export const authLite = createAuthLite();

/** API приложения: авторизация и защищённые данные. */
export const app = new Hono<{ Variables: AuthLiteVariables }>();

mountAuthLite(app, authLite);

app.get("/api/notes", requireUser(authLite), (c) =>
  c.json({ owner: c.get("user").email, notes: ["Купить молоко", "Позвонить маме"] }),
);

/** Проверка настроек при старте: без секрета процесс останавливается с подсказкой. */
export async function startAuthLite() {
  try {
    await authLite.ready();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
