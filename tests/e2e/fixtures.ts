import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { getStorageConfig } from "../../src/server/config";
import { openDatabase } from "../../src/server/db";
import { createRepository, type ResearchRepository } from "../../src/server/db/repository";
export function fixture<T>(work: (repo: ResearchRepository) => T): T {
  const connection = openDatabase(getStorageConfig({ LABNOTE_DATA_DIR: resolve("test-results/storage/data"), LABNOTE_ATTACHMENTS_DIR: resolve("test-results/storage/attachments"), LABNOTE_BACKUP_DIR: resolve("test-results/storage/backups") }));
  try { return work(createRepository(connection)); } finally { connection.close(); }
}
export function entryFixture() {
  return fixture(repo => {
    const project = repo.create({ kind: "project", title: `研究 ${randomUUID()}` });
    const series = repo.create({ kind: "series", title: "比較実験", parentId: project.id });
    return repo.create({ kind: "entry", title: "日次記録", parentId: series.id, date: "2026-11-06" });
  });
}
