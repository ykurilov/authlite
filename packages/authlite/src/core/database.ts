import { accessSync, constants, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { AuthLiteConfigError } from "./errors.js";

/** Открывает файл SQLite, создавая папку при необходимости. Без права записи — понятная ошибка. */
export function openDatabase(path: string): DatabaseSync {
  const folder = dirname(path);
  try {
    mkdirSync(folder, { recursive: true });
    accessSync(folder, constants.W_OK);
    if (existsSync(path)) accessSync(path, constants.W_OK);
  } catch {
    throw new AuthLiteConfigError(
      `Нет права записи в файл базы ${path} (папка ${folder}). Дайте процессу право записи ` +
        "в эту папку или укажите другой путь в AUTHLITE_DB_PATH",
    );
  }
  const database = new DatabaseSync(path);
  database.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  return database;
}
