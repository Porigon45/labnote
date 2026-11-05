import { openDatabase } from "./db";
import { createRepository, type ResearchRepository } from "./db/repository";
import type { records } from "./db/schema";

export type ResearchRecord = typeof records.$inferSelect;
export type FlowKind = "project" | "series" | "entry";
export const kindLabels = { project: "プロジェクト", series: "実験シリーズ", entry: "日次記録" };
export const statusLabels = { planned: "予定", active: "進行中", completed: "完了" };
export function recordPath(record: Pick<ResearchRecord, "kind" | "id">) {
  const segment = record.kind === "project" ? "projects" : record.kind === "series" ? "series" : record.kind === "protocol" ? "protocols" : record.kind === "sample" ? "samples" : record.kind === "memo" ? "memos" : "entries";
  return `/${segment}/${record.id}`;
}
export function withResearch<T>(work: (repo: ResearchRepository) => T): T {
  const connection = openDatabase();
  try { return work(createRepository(connection)); }
  finally { connection.close(); }
}
export function today() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
}
