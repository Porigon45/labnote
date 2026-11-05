import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { getStorageConfig } from "../../src/server/config";
import { openDatabase, type DatabaseConnection } from "../../src/server/db";
import { migrateDatabase } from "../../src/server/db/migrate";
import { ConflictError, createRepository, type ResearchRepository } from "../../src/server/db/repository";
import { seedResearchFixture } from "../../src/server/db/seed";

let root: string;
let connection: DatabaseConnection;
let repo: ResearchRepository;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "labnote-research-test-"));
  const config = getStorageConfig({}, root);
  migrateDatabase(config);
  connection = openDatabase(config);
  repo = createRepository(connection);
});
afterEach(() => { connection.close(); rmSync(root, { recursive: true, force: true }); });

it("seeds a complete research hierarchy and persists it across reopen", () => {
  const f = seedResearchFixture(repo);
  const page = repo.detail(f.entry.id);
  expect(page.tags).toEqual(expect.arrayContaining(["測定", "テスト"]));
  expect(page.protocols[0].version.title).toBe("測定手順");
  expect(repo.detail(f.series.id).children.map(c => c.id)).toEqual([f.entry.id]);
  expect(repo.detail(f.derived.id).sample?.parentSampleId).toBe(f.sample.id);
  expect(repo.detail(f.sample.id).derivedSamples[0].recordId).toBe(f.derived.id);
  expect(repo.detail(f.derived.id).backlinks[0].sourceId).toBe(f.entry.id);
  connection.close();
  connection = openDatabase(getStorageConfig({}, root));
  repo = createRepository(connection);
  expect(repo.detail(f.entry.id)).toEqual(page);
});

it("rejects missing parents, incorrect hierarchy, empty titles and invalid dates", () => {
  const project = repo.create({ kind: "project", title: "研究" });
  expect(() => repo.create({ kind: "entry", title: "記録", parentId: project.id, date: "2026-11-05" })).toThrow();
  expect(() => repo.create({ kind: "series", title: "実験", parentId: "missing" })).toThrow();
  expect(() => repo.create({ kind: "project", title: " " })).toThrow();
  expect(() => repo.create({ kind: "page", title: "メモ", date: "2026-02-30" })).toThrow();
  expect(repo.list().length).toBe(1);
});

it("updates only the expected revision and rejects stale saves without data loss", () => {
  const page = repo.create({ kind: "page", title: "初期" });
  const saved = repo.update(page.id, 1, { title: "新しい内容", body: [{ id: "p1", type: "paragraph", content: "測定記録" }] });
  expect(saved.revision).toBe(2);
  expect(() => repo.update(page.id, 1, { title: "古い内容" })).toThrow(ConflictError);
  expect(repo.get(page.id)?.title).toBe("新しい内容");
});

it("keeps used protocol content unchanged and disallows mutating historical versions", () => {
  const f = seedResearchFixture(repo);
  const before = repo.detail(f.entry.id).protocols;
  repo.update(f.protocol.id, 1, { title: "新手順", body: [{ id: "step-2", type: "paragraph", content: "更新後" }] });
  expect(repo.detail(f.protocol.id).versions.map(v => v.version)).toEqual([2, 1]);
  expect(repo.detail(f.entry.id).protocols).toEqual(before);
  expect(() => connection.sqlite.prepare("UPDATE protocol_versions SET title=? WHERE id=?").run("書換", before[0].version.id)).toThrow(/immutable/);
  expect(() => connection.sqlite.prepare("DELETE FROM protocol_versions WHERE id=?").run(before[0].version.id)).toThrow();
});

it("rolls back invalid sample creation and prevents ancestry cycles", () => {
  const f = seedResearchFixture(repo);
  const count = repo.list("sample").length;
  expect(() => repo.createSample({ title: "無効", type: "strain", parentSampleId: "missing" })).toThrow();
  expect(repo.list("sample").length).toBe(count);
  expect(() => repo.updateSample(f.sample.id, 1, { parentSampleId: f.derived.id })).toThrow();
  expect(repo.get(f.sample.id)?.revision).toBe(1);
  repo.updateSample(f.derived.id, 1, { location: "冷蔵棚" });
  expect(repo.detail(f.derived.id).sample?.location).toBe("冷蔵棚");
});

it("hides descendants of archived projects and restores them without changing child flags", () => {
  const f = seedResearchFixture(repo);
  const archived = repo.setArchived(f.project.id, 1, true);
  expect(repo.list("entry")).toEqual([]);
  expect(repo.list("entry", undefined, true).map(r => r.id)).toEqual([f.entry.id]);
  expect(repo.get(f.entry.id)?.archivedAt).toBeNull();
  repo.setArchived(f.project.id, archived.revision, false);
  expect(repo.list("entry").map(r => r.id)).toEqual([f.entry.id]);
});

it("deduplicates tags and links and enforces related record references", () => {
  const f = seedResearchFixture(repo);
  repo.setTags(f.entry.id, [" 測定 ", "測定", ""]);
  expect(repo.detail(f.entry.id).tags).toEqual(["測定"]);
  repo.link(f.entry.id, f.derived.id);
  expect(repo.detail(f.entry.id).outgoing).toHaveLength(1);
  expect(() => repo.link(f.entry.id, "missing")).toThrow();
  expect(() => repo.link(f.entry.id, f.entry.id)).toThrow();
});

it("persists measurement values, nulls and attachment metadata and validates shape", () => {
  const f = seedResearchFixture(repo);
  const data = { xLabel: "時間", xUnit: "h", yLabel: "OD", yUnit: "", series: ["A", "B"], rows: [{ x: 0, values: [0.1, null] }, { x: 1, values: [0.2, 0.3] }] };
  repo.addMeasurement(f.entry.id, data);
  repo.addAttachment({ recordId: f.entry.id, filename: "写真.png", storageKey: "photo-1", mime: "image/png", bytes: 100, caption: "結果" });
  expect(repo.detail(f.entry.id).measurements[0].data).toEqual(data);
  expect(repo.detail(f.entry.id).attachments[0].caption).toBe("結果");
  expect(() => repo.addMeasurement(f.entry.id, { ...data, rows: [{ x: 0, values: [1] }] })).toThrow();
  expect(() => repo.addAttachment({ recordId: f.entry.id, filename: "a", storageKey: "../escape", mime: "image/png", bytes: 10 })).toThrow();
});
