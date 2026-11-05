import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { getStorageConfig, type StorageConfig } from "../src/server/config";
import { migrateDatabase } from "../src/server/db/migrate";
import { openDatabase } from "../src/server/db";
import { createRepository } from "../src/server/db/repository";
import { seedResearchFixture } from "../src/server/db/seed";
import { saveAttachment } from "../src/server/attachments";
import { listBackups, restoreBackup } from "../src/server/backup";
import { initialMeasurement } from "../src/lib/measurement";

const root = mkdtempSync(join(tmpdir(), "labnote-production-"));
const base = "http://127.0.0.1:3200";
let child: ChildProcess | undefined;
let logs = "";
async function start(config: StorageConfig) {
  logs = "";
  child = spawn(process.execPath, [resolve("node_modules/tsx/dist/cli.mjs"), "scripts/serve.ts", "start", "--port", "3200"], { env: { ...process.env, NODE_ENV: "production", LABNOTE_DATA_DIR: config.dataDir, LABNOTE_ATTACHMENTS_DIR: config.attachmentsDir, LABNOTE_BACKUP_DIR: config.backupDir, NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout?.on("data", chunk => { logs = (logs + chunk).slice(-20000); }); child.stderr?.on("data", chunk => { logs = (logs + chunk).slice(-20000); });
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline && child.exitCode === null) {
    try { const response = await fetch(base + "/api/health"); if (response.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error("本番サーバーを起動できませんでした。" + logs);
}
async function stop() {
  const current = child; child = undefined;
  if (!current || current.exitCode !== null) return;
  await new Promise<void>((resolveExit, reject) => {
    const timer = setTimeout(() => { current.kill("SIGKILL"); reject(new Error("本番サーバーの停止がタイムアウトしました。")); }, 10000);
    current.once("exit", () => { clearTimeout(timer); resolveExit(); });
    current.kill("SIGTERM");
  });
}
try {
  const config = getStorageConfig({}, join(root, "source")); migrateDatabase(config);
  const connection = openDatabase(config); const repo = createRepository(connection);
  const f = seedResearchFixture(repo);
  const body = [{ id: "discussion", type: "paragraph", content: [{ type: "text", text: "観察・議論：温度条件を比較。次の操作：再培養。", styles: {} }] }, { id: "od-table", type: "measurement", props: { data: JSON.stringify({ ...initialMeasurement, rows: [{ x: 0, values: [0.12, 0.2] }, { x: 1, values: [0.4, 0.5] }] }), view: "table" } }];
  const expected = repo.update(f.entry.id, 1, { body, title: "代表実験 OD600 培養" });
  for (let i = 1; i < 500; i++) repo.create({ kind: "entry", title: `培養観察 ${i}`, parentId: f.series.id, date: `2026-11-${String(i % 28 + 1).padStart(2, "0")}`, body: Array.from({ length: 12 }, (_, j) => ({ id: `b-${i}-${j}`, type: "paragraph", content: [{ type: "text", text: `培養条件とOD600。議論、観察、次の操作 ${i}`, styles: {} }] })) });
  connection.close();
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9p0AAAAASUVORK5CYII=", "base64");
  const attachment = await saveAttachment(f.entry.id, "result.png", new Blob([png]).stream(), config);
  await start(config);
  const measurements: Record<string, { p50Ms: number; p95Ms: number }> = {};
  for (const [name, path] of Object.entries({ dashboard: "/", series: `/series/${f.series.id}`, entry: `/entries/${f.entry.id}`, search: "/search?q=OD600" })) {
    const times: number[] = [];
    for (let i = 0; i < 6; i++) { const begin = performance.now(); const response = await fetch(base + path); assert.equal(response.status, 200); const text = await response.text(); assert(text.includes("labnote")); if (i) times.push(performance.now() - begin); }
    times.sort((a, b) => a - b); measurements[name] = { p50Ms: +times[2].toFixed(2), p95Ms: +times[4].toFixed(2) };
    assert(times[4] < 2000, `${name}が2秒を超えています。`);
  }
  await stop(); await start(config);
  assert.deepEqual((await (await fetch(base + `/api/records/${f.entry.id}`)).json()).body, expected.body);
  await stop();
  const restored = await restoreBackup(listBackups(config)[0].directory, join(root, "restored"));
  await start(restored);
  const record = await (await fetch(base + `/api/records/${f.entry.id}`)).json();
  assert.deepEqual(record.body, expected.body);
  const restoredImage = await fetch(base + `/api/attachments/${attachment.id}`);
  assert.equal(restoredImage.status, 200); assert(Buffer.from(await restoredImage.arrayBuffer()).equals(png));
  const text = await (await fetch(base + `/entries/${f.entry.id}`)).text();
  assert(text.includes("測定手順") && text.includes("試料A-1"));
  console.log(JSON.stringify({ records: 500, productionHttp: measurements, restart: "passed", restoreDatabaseAndImage: "passed", protocolAndSampleReferences: "passed" }, null, 2));
} catch (error) { console.error(logs); throw error; }
finally { await stop(); rmSync(root, { recursive: true, force: true }); }
