import { resolve } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { getStorageConfig, type StorageConfig } from "../config";
import { openDatabase } from "./index";

export function migrateDatabase(
  config: StorageConfig = getStorageConfig(),
  migrationsFolder = resolve(process.cwd(), "drizzle"),
): void {
  const connection = openDatabase(config);
  try {
    migrate(connection.db, { migrationsFolder });
  } finally {
    connection.close();
  }
}
