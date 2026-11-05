import { chmodSync, existsSync, mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { getStorageConfig, type StorageConfig } from "../config";
import * as schema from "./schema";

/** Server-only SQLite connection. Call close() when the owning operation finishes. */
export function openDatabase(config: StorageConfig = getStorageConfig()) {
  for (const directory of [config.dataDir, config.attachmentsDir, config.backupDir]) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
  }

  const existed = existsSync(config.databasePath);
  const sqlite = new Database(config.databasePath, { timeout: 5_000 });

  try {
    if (!existed) chmodSync(config.databasePath, 0o600);
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("journal_mode = WAL");
    const db = drizzle(sqlite, { schema });
    return { db, sqlite, close: () => sqlite.close() };
  } catch (error) {
    sqlite.close();
    throw error;
  }
}

export type DatabaseConnection = ReturnType<typeof openDatabase>;
