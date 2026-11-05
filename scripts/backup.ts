import nextEnv from "@next/env";
import { createBackup, listBackups, restoreBackup } from "../src/server/backup";
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
try {
  const [command, source, destination] = process.argv.slice(2);
  if (command === "create") console.log(await createBackup());
  else if (command === "list") console.log(JSON.stringify(listBackups(), null, 2));
  else if (command === "restore" && source && destination) console.log(JSON.stringify(await restoreBackup(source, destination), null, 2));
  else throw new Error("backup:create / backup:list / backup:restore -- <バックアップ> <空の復元先> を指定してください。");
} catch (error) { console.error(error instanceof Error ? error.message : "バックアップ処理に失敗しました。"); process.exitCode = 1; }
