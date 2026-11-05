import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text, uniqueIndex, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";

export const kinds = ["theme", "project", "series", "entry", "protocol", "sample", "memo", "page"] as const;
export type RecordKind = typeof kinds[number];
export type Block = { id: string; type: string; [key: string]: unknown };

export const records = sqliteTable("records", {
  id: text("id").primaryKey(),
  kind: text("kind", { enum: kinds }).notNull(),
  parentId: text("parent_id").references((): AnySQLiteColumn => records.id),
  title: text("title").notNull(),
  body: text("body", { mode: "json" }).$type<Block[]>().notNull().default([]),
  purpose: text("purpose").notNull().default(""),
  hypothesis: text("hypothesis").notNull().default(""),
  status: text("status", { enum: ["planned", "active", "completed"] }).notNull().default("active"),
  date: text("date"),
  endDate: text("end_date"),
  category: text("category").notNull().default(""),
  revision: integer("revision").notNull().default(1),
  archivedAt: text("archived_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, () => [check("record_title", sql`length(trim(title)) > 0`)]);

export const samples = sqliteTable("samples", {
  recordId: text("record_id").primaryKey().references(() => records.id),
  type: text("type", { enum: ["strain", "plasmid", "primer", "medium", "other"] }).notNull(),
  parentSampleId: text("parent_sample_id").references((): AnySQLiteColumn => samples.recordId),
  origin: text("origin").notNull().default(""),
  location: text("location").notNull().default(""),
});

export const protocolVersions = sqliteTable("protocol_versions", {
  id: text("id").primaryKey(),
  protocolId: text("protocol_id").notNull().references(() => records.id),
  version: integer("version").notNull(),
  title: text("title").notNull(),
  body: text("body", { mode: "json" }).$type<Block[]>().notNull(),
  createdAt: text("created_at").notNull(),
}, t => [uniqueIndex("protocol_version_unique").on(t.protocolId, t.version)]);

export const protocolSnapshots = sqliteTable("protocol_snapshots", {
  id: text("id").primaryKey(),
  entryId: text("entry_id").notNull().references(() => records.id),
  versionId: text("version_id").notNull().references(() => protocolVersions.id),
  changes: text("changes").notNull().default(""),
  createdAt: text("created_at").notNull(),
}, t => [uniqueIndex("entry_protocol_version_unique").on(t.entryId, t.versionId)]);

export type MeasurementData = {
  xLabel: string; xUnit: string; yLabel: string; yUnit: string;
  series: string[]; rows: { x: number; values: (number | null)[] }[];
};
export const measurements = sqliteTable("measurements", {
  id: text("id").primaryKey(),
  recordId: text("record_id").notNull().references(() => records.id),
  data: text("data", { mode: "json" }).$type<MeasurementData>().notNull(),
  createdAt: text("created_at").notNull(),
});
export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  recordId: text("record_id").notNull().references(() => records.id),
  filename: text("filename").notNull(),
  storageKey: text("storage_key").notNull().unique(),
  mime: text("mime").notNull(),
  bytes: integer("bytes").notNull(),
  caption: text("caption").notNull().default(""),
  archivedAt: text("archived_at"),
  createdAt: text("created_at").notNull(),
});
export const links = sqliteTable("content_links", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull().references(() => records.id),
  targetId: text("target_id").notNull().references(() => records.id),
  createdAt: text("created_at").notNull(),
}, t => [uniqueIndex("content_link_unique").on(t.sourceId, t.targetId)]);
export const tags = sqliteTable("tags", { id: text("id").primaryKey(), name: text("name").notNull().unique() });
export const recordTags = sqliteTable("record_tags", {
  recordId: text("record_id").notNull().references(() => records.id),
  tagId: text("tag_id").notNull().references(() => tags.id),
}, t => [uniqueIndex("record_tag_unique").on(t.recordId, t.tagId)]);
