// Живая проверка запущенного примера: node scripts/smoke.mjs http://localhost:3000
const base = process.argv[2];
const email = `smoke-${Date.now()}@example.com`;
let cookie = "";

async function call(path, body) {
  const headers = { origin: base, cookie };
  if (body) headers["content-type"] = "application/json";
  const response = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const setCookie = response.headers.getSetCookie().map((line) => line.split(";")[0]).filter((pair) => !pair.endsWith("="));
  if (setCookie.length) cookie = setCookie.join("; ");
  return response;
}

const show = async (label, response) => {
  const location = response.headers.get("location");
  const text = response.headers.get("content-type")?.includes("json") ? await response.text() : "";
  console.log(`${label}: ${response.status}${location ? ` → ${location}` : ""}${text ? ` ${text.slice(0, 120)}` : ""}`);
};

await show("notes без входа", await call("/api/notes"));
await show("dashboard без входа", await call("/dashboard"));
await show("регистрация", await call("/api/auth/sign-up/email", { email, password: "password-123", name: "" }));
await show("notes после входа", await call("/api/notes"));
await show("dashboard после входа", await call("/dashboard"));
await show("выход", await call("/api/auth/sign-out", {}));
await show("notes после выхода", await call("/api/notes"));
await show("запрос сброса", await call("/api/auth/request-password-reset", { email, redirectTo: "/reset-password" }));
