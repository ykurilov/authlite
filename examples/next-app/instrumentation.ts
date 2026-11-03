// Проверка настроек AuthLite при старте сервера: без секрета запуск останавливается сразу.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { nextAuth } = await import("./lib/auth");
    await nextAuth.startup();
  }
}
