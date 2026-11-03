import type { DatabaseSync } from "node:sqlite";

const RESET_IDENTIFIER_PREFIX = "reset-password:";

/**
 * Оставляет рабочей только последнюю ссылку сброса пользователя.
 * Better Auth хранит ссылку в таблице verification: identifier = "reset-password:<токен>", value = id пользователя.
 */
export function revokeOlderResetLinks(database: DatabaseSync, userId: string, currentToken: string): void {
  database
    .prepare("DELETE FROM verification WHERE value = ? AND identifier LIKE ? AND identifier <> ?")
    .run(userId, `${RESET_IDENTIFIER_PREFIX}%`, `${RESET_IDENTIFIER_PREFIX}${currentToken}`);
}
