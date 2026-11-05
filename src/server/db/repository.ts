import { randomUUID } from "node:crypto";
import { validMeasurement } from "../../lib/measurement";
import { and, desc, eq } from "drizzle-orm";
import type { DatabaseConnection } from "./index";
import { attachments, links, measurements, protocolSnapshots, protocolVersions, records, recordTags, samples, tags, type Block, type MeasurementData, type RecordKind } from "./schema";

export class ConflictError extends Error {
  constructor() { super("別の編集が保存されています。最新の内容を再取得してください。"); }
}
export type CreateRecord = {
  kind: RecordKind; title: string; parentId?: string;
  body?: Block[]; purpose?: string; hypothesis?: string;
  status?: "planned" | "active" | "completed";
  date?: string; endDate?: string; category?: string;
};
type RecordPatch = Partial<Pick<CreateRecord, "title" | "body" | "purpose" | "hypothesis" | "status" | "date" | "endDate" | "category">>;
const now = () => new Date().toISOString();
function date(value: string | undefined) {
  if (value !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value)) {
    throw new Error("日付は有効な YYYY-MM-DD を指定してください。");
  }
}
function validate(input: RecordPatch) {
  if (input.title !== undefined && !input.title.trim()) throw new Error("タイトルを入力してください。");
  date(input.date); date(input.endDate);
  if (input.body !== undefined && (!Array.isArray(input.body) || input.body.some(b => !b || typeof b.id !== "string" || typeof b.type !== "string"))) throw new Error("本文ブロックが不正です。");
}

/** Owns no connection: caller closes the supplied connection after use. */
export function createRepository(connection: DatabaseConnection) {
  const { db } = connection;
  // Acquire the writer lock before reading: deferred read-to-write upgrades can
  // fail immediately with SQLITE_BUSY when another connection writes in WAL mode.
  const transaction = <T>(work: () => T): T => db.transaction(work, { behavior: "immediate" });
  const get = (id: string) => db.select().from(records).where(eq(records.id, id)).get();
  const requireRecord = (id: string) => {
    const record = get(id);
    if (!record) throw new Error("記録が見つかりません。");
    return record;
  };
  function addVersion(protocol: typeof records.$inferSelect) {
    return db.insert(protocolVersions).values({
      id: randomUUID(), protocolId: protocol.id, version: protocol.revision,
      title: protocol.title, body: protocol.body, createdAt: now(),
    }).returning().get();
  }
  function create(input: CreateRecord) {
    validate(input);
    if (input.kind === "entry" && !input.date) throw new Error("日次記録の日付を入力してください。");
    if (input.kind === "sample") throw new Error("試料はcreateSampleで作成してください。");
    return transaction(() => insert(input));
  }
  function insert(input: CreateRecord) {
    if (input.parentId) requireRecord(input.parentId);
    const timestamp = now();
    const record = db.insert(records).values({ ...input, title: input.title.trim(), id: randomUUID(), createdAt: timestamp, updatedAt: timestamp }).returning().get();
    if (record.kind === "protocol") addVersion(record);
    return record;
  }
  function update(id: string, revision: number, patch: RecordPatch) {
    validate(patch);
    return transaction(() => {
      const existing = requireRecord(id);
      if (existing.revision !== revision) throw new ConflictError();
      const updated = db.update(records).set({ ...patch, title: patch.title?.trim() ?? existing.title, revision: revision + 1, updatedAt: now() })
        .where(and(eq(records.id, id), eq(records.revision, revision))).returning().get();
      if (!updated) throw new ConflictError();
      if (patch.body !== undefined) {
        db.delete(measurements).where(eq(measurements.recordId, id)).run();
        const collect = (blocks: Block[]) => {
          for (const b of blocks) {
            if (b.type === "measurement") {
              const data = JSON.parse((b.props as { data: string }).data) as MeasurementData;
              if (!validMeasurement(data)) throw new Error("測定値が不正です。");
              db.insert(measurements).values({ id: b.id, recordId: id, data, createdAt: now() }).run();
            }
            if (Array.isArray(b.children)) collect(b.children as Block[]);
          }
        };
        collect(patch.body);
      }
      if (updated.kind === "protocol") addVersion(updated);
      return updated;
    });
  }
  function list(kind?: RecordKind, parentId?: string, archived = false) {
    // A child of an archived project/series is hidden without changing its own archive flag.
    const hidden = connection.sqlite.prepare(`WITH RECURSIVE hidden(id) AS (
      SELECT id FROM records WHERE archived_at IS NOT NULL
      UNION SELECT r.id FROM records r JOIN hidden h ON r.parent_id=h.id
    ) SELECT id FROM hidden`).all() as { id: string }[];
    const hiddenIds = new Set(hidden.map(r => r.id));
    return db.select().from(records).orderBy(desc(records.updatedAt), records.id).all()
      .filter(r => (!kind || r.kind === kind) && (!parentId || r.parentId === parentId) && hiddenIds.has(r.id) === archived);
  }
  function setArchived(id: string, revision: number, archived: boolean) {
    requireRecord(id);
    const result = db.update(records).set({ archivedAt: archived ? now() : null, updatedAt: now(), revision: revision + 1 })
      .where(and(eq(records.id, id), eq(records.revision, revision))).returning().get();
    if (!result) throw new ConflictError();
    return result;
  }
  function setTags(id: string, names: string[]) {
    requireRecord(id);
    const cleaned = [...new Set(names.map(n => n.trim()).filter(Boolean))];
    transaction(() => {
      db.delete(recordTags).where(eq(recordTags.recordId, id)).run();
      for (const name of cleaned) {
        db.insert(tags).values({ id: randomUUID(), name }).onConflictDoNothing().run();
        const tag = db.select().from(tags).where(eq(tags.name, name)).get()!;
        db.insert(recordTags).values({ recordId: id, tagId: tag.id }).run();
      }
    });
  }
  function link(sourceId: string, targetId: string) {
    db.insert(links).values({ id: randomUUID(), sourceId, targetId, createdAt: now() }).onConflictDoNothing().run();
  }
  function createSample(input: Omit<CreateRecord, "kind"> & { type: typeof samples.$inferInsert.type; parentSampleId?: string; origin?: string; location?: string }) {
    validate(input);
    return transaction(() => {
      const { type, parentSampleId, origin, location, ...page } = input;
      const record = insert({ ...page, kind: "sample" });
      db.insert(samples).values({ recordId: record.id, type, parentSampleId, origin, location }).run();
      return record;
    });
  }
  function useProtocol(entryId: string, versionId: string, changes = "") {
    return db.insert(protocolSnapshots).values({ id: randomUUID(), entryId, versionId, changes, createdAt: now() }).returning().get();
  }
  function updateSample(id: string, revision: number, patch: Partial<Pick<typeof samples.$inferInsert, "type" | "parentSampleId" | "origin" | "location">>) {
    return transaction(() => {
      if (requireRecord(id).kind !== "sample") throw new Error("試料ではありません。");
      update(id, revision, {});
      return db.update(samples).set(patch).where(eq(samples.recordId, id)).returning().get();
    });
  }
  function editSample(id: string, revision: number, page: RecordPatch, patch: Partial<Pick<typeof samples.$inferInsert, "type" | "parentSampleId" | "origin" | "location">>) {
    return transaction(() => {
      if (requireRecord(id).kind !== "sample") throw new Error("試料ではありません。");
      const record = update(id, revision, page);
      db.update(samples).set(patch).where(eq(samples.recordId, id)).run();
      return record;
    });
  }
  function addMeasurement(recordId: string, data: MeasurementData) {
    if (!data.series.length || new Set(data.series).size !== data.series.length || data.series.some(s => !s.trim()) || data.rows.some(r => !Number.isFinite(r.x) || r.values.length !== data.series.length || r.values.some(v => v !== null && !Number.isFinite(v)))) throw new Error("測定値と系列の形式が不正です。");
    return db.insert(measurements).values({ id: randomUUID(), recordId, data, createdAt: now() }).returning().get();
  }
  function addAttachment(input: Omit<typeof attachments.$inferInsert, "id" | "createdAt" | "archivedAt">) {
    if (!/^[\w-]+$/.test(input.storageKey)) throw new Error("添付の保存キーが不正です。");
    return db.insert(attachments).values({ ...input, id: randomUUID(), createdAt: now() }).returning().get();
  }
  function detail(id: string) {
    const record = requireRecord(id);
    return {
      ...record,
      children: list(undefined, id),
      tags: db.select({ name: tags.name }).from(recordTags).innerJoin(tags, eq(tags.id, recordTags.tagId)).where(eq(recordTags.recordId, id)).all().map(t => t.name),
      sample: db.select().from(samples).where(eq(samples.recordId, id)).get(),
      derivedSamples: db.select().from(samples).where(eq(samples.parentSampleId, id)).all(),
      versions: db.select().from(protocolVersions).where(eq(protocolVersions.protocolId, id)).orderBy(desc(protocolVersions.version)).all(),
      protocols: db.select({ snapshot: protocolSnapshots, version: protocolVersions }).from(protocolSnapshots).innerJoin(protocolVersions, eq(protocolSnapshots.versionId, protocolVersions.id)).where(eq(protocolSnapshots.entryId, id)).all(),
      measurements: db.select().from(measurements).where(eq(measurements.recordId, id)).all(),
      attachments: db.select().from(attachments).where(eq(attachments.recordId, id)).all(),
      outgoing: db.select().from(links).where(eq(links.sourceId, id)).all(),
      backlinks: db.select().from(links).where(eq(links.targetId, id)).all(),
    };
  }
  return { create, get, list, update, setArchived, setTags, link, createSample, updateSample, editSample, useProtocol, addMeasurement, addAttachment, detail };
}

export type ResearchRepository = ReturnType<typeof createRepository>;
