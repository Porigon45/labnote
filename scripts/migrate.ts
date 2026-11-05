import nextEnv from "@next/env";
import { getStorageConfig } from "../src/server/config";
import { migrateDatabase } from "../src/server/db/migrate";

try {
  nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
  const config = getStorageConfig();
  migrateDatabase(config);
  console.info("データベースのマイグレーションが完了しました。");
} catch (error) {
  console.error("データベースのマイグレーションに失敗しました。", error);
  process.exitCode = 1;
}
