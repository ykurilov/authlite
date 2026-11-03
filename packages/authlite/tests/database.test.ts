import { chmodSync, existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/core/database.js";
import { AuthLiteConfigError } from "../src/core/errors.js";

describe("openDatabase", () => {
  it("создаёт папку и файл базы", () => {
    const path = join(mkdtempSync(join(tmpdir(), "authlite-")), "nested", "auth.sqlite");
    const db = openDatabase(path);
    db.exec("create table t (x int)");
    expect(existsSync(path)).toBe(true);
    db.close();
  });

  it("папка без права записи — понятная ошибка с путём", () => {
    const dir = join(mkdtempSync(join(tmpdir(), "authlite-")), "readonly");
    mkdirSync(dir);
    chmodSync(dir, 0o500);
    const path = join(dir, "auth.sqlite");
    try {
      expect(() => openDatabase(path)).toThrow(AuthLiteConfigError);
      expect(() => openDatabase(path)).toThrow(dir);
    } finally {
      chmodSync(dir, 0o700);
    }
  });
});
