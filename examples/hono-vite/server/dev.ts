// Разработка: один процесс — Hono отвечает на /api/*, Vite отдаёт страницы с горячей перезагрузкой.
import { createServer } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { createServer as createViteServer } from "vite";
import { app, startAuthLite } from "./app.ts";

await startAuthLite();

const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
const api = getRequestListener(app.fetch);
const port = Number(process.env.PORT ?? 5173);

createServer((request, response) => {
  if (request.url?.startsWith("/api/")) return api(request, response);
  vite.middlewares(request, response);
}).listen(port, () => console.log(`Пример Hono + Vite: http://localhost:${port}`));
