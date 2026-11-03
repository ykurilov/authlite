// Рабочий режим: Hono отдаёт API, собранные страницы (vite build) и защищает /dashboard на сервере.
import { readFileSync } from "node:fs";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { requirePage } from "@ykurilov/authlite/hono";
import { app, authLite, startAuthLite } from "./app.ts";

await startAuthLite();

const indexHtml = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");

app.use("/assets/*", serveStatic({ root: "./dist" }));
app.get("/dashboard", requirePage(authLite), (c) => c.html(indexHtml));
app.get("*", (c) => c.html(indexHtml));

const port = Number(process.env.PORT ?? 5173);
serve({ fetch: app.fetch, port }, () => console.log(`Пример Hono + Vite: http://localhost:${port}`));
