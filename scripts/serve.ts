import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { ensureDailyBackup } from "../src/server/backup";
import { migrateDatabase } from "../src/server/db/migrate";

const [mode, ...args] = process.argv.slice(2);
if (!["dev", "start"].includes(mode) || args.some(a => a === "--hostname" || a.startsWith("-H") || a.startsWith("--hostname="))) throw new Error("起動はdev/start、待ち受けアドレスはLABNOTE_HOSTで指定してください。");
if (mode === "start") Object.assign(process.env, { NODE_ENV: "production" });
nextEnv.loadEnvConfig(process.cwd(), mode === "dev");
const hostname = process.env.LABNOTE_HOST?.trim() || "127.0.0.1";
migrateDatabase();
let backingUp = false;
async function backup() {
  if (backingUp) return;
  backingUp = true;
  try { const path = await ensureDailyBackup(); if (path) console.info("日次バックアップを作成しました。"); }
  catch (error) { console.error("日次バックアップに失敗しました。保存とバックアップ画面で確認してください。", error); }
  finally { backingUp = false; }
}
await backup();
const timer = setInterval(backup, 60_000); timer.unref();
const child = spawn(process.execPath, [fileURLToPath(import.meta.resolve("next/dist/bin/next")), mode, "--hostname", hostname, ...args], { stdio: "inherit", env: process.env });
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => { clearInterval(timer); child.kill(signal); });
child.on("exit", (code) => { clearInterval(timer); process.exitCode = code ?? 0; });
child.on("error", error => { console.error(error); clearInterval(timer); process.exitCode = 1; });
