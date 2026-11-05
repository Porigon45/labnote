import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { getStorageConfig } from "../src/server/config";
import { migrateDatabase } from "../src/server/db/migrate";
import { openDatabase } from "../src/server/db";
import { createRepository } from "../src/server/db/repository";
import { searchRecords } from "../src/server/search";

const root = mkdtempSync(join(tmpdir(), "labnote-benchmark-"));
const config = getStorageConfig({}, root);
migrateDatabase(config);
const connection = openDatabase(config);
try {
  const repo = createRepository(connection);
  const project = repo.create({ kind: "project", title: "性能検証" });
  const series = repo.create({ kind: "series", title: "OD600 生育曲線", parentId: project.id });
  let last = "";
  for (let i = 0; i < 500; i++) last = repo.create({ kind: "entry", title: `培養観察 ${i}`, parentId: series.id, date: `2026-11-${String(i % 28 + 1).padStart(2, "0")}`, body: Array.from({ length: 12 }, (_, j) => ({ id: `p-${i}-${j}`, type: "paragraph", content: [{ type: "text", text: `試料BY4741の培養とOD600測定。条件比較 ${i}。議論と次の操作。`, styles: {} }] })) }).id;
  const results: Record<string, { p50Ms: number; p95Ms: number }> = {};
  for (const [name, work] of Object.entries({ list: () => repo.list("entry"), detail: () => repo.detail(last), searchJapanese: () => searchRecords({ q: "培養観察", series: series.id }, connection), searchASCII: () => searchRecords({ q: "OD600" }, connection) })) {
    const times = Array.from({ length: 20 }, () => { const start = performance.now(); work(); return performance.now() - start; }).sort((a, b) => a - b);
    results[name] = { p50Ms: Number(times[10].toFixed(2)), p95Ms: Number(times[18].toFixed(2)) };
    if (times[18] > 1000) process.exitCode = 1;
  }
  console.log(JSON.stringify({ records: 500, blocksPerRecord: 12, measurements: results }, null, 2));
} finally { connection.close(); rmSync(root, { recursive: true, force: true }); }
