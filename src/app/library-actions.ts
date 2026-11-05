"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ConflictError } from "@/server/db/repository";
import { collections, memoCategories, sampleTypes, type Collection } from "@/lib/library";
import { recordPath, withResearch } from "@/server/research";
import type { FormState } from "./actions";

const field = (data: FormData, name: string) => typeof data.get(name) === "string" ? String(data.get(name)).trim() : "";
export async function saveLibrary(_state: FormState, data: FormData): Promise<FormState> {
  const collection = field(data, "collection") as Collection;
  if (!Object.hasOwn(collections, collection)) return { error: "種類が不正です。" };
  const kind = collections[collection].kind;
  const title = field(data, "title");
  const id = field(data, "id");
  const category = field(data, "category");
  const status = field(data, "status");
  if (!title) return { error: "タイトルを入力してください。" };
  if (!["active", "planned", "completed"].includes(status)) return { error: "状態が不正です。" };
  if (kind === "memo" && !memoCategories.some(c => c === category)) return { error: "カテゴリを選択してください。" };
  let path: string;
  try {
    path = withResearch(repo => {
      if (id && !repo.list(kind).some(r => r.id === id)) throw new Error("対象が見つかりません。");
      const page = { title, category, status: status as "active" | "planned" | "completed", purpose: field(data, "purpose"), ...(kind === "sample" ? { date: field(data, "date") } : {}) };
      let record;
      if (kind === "sample") {
        const type = field(data, "type") as keyof typeof sampleTypes;
        if (!Object.hasOwn(sampleTypes, type)) throw new Error("試料の種類を選択してください。");
        const parentSampleId = field(data, "parentSampleId");
        if (parentSampleId && !repo.list("sample").some(r => r.id === parentSampleId)) throw new Error("親試料が見つかりません。");
        if (!page.date) throw new Error("作製日を入力してください。");
        const meta = { type, origin: field(data, "origin"), location: field(data, "location") };
        record = id ? repo.editSample(id, Number(field(data, "revision")), page, { ...meta, parentSampleId: parentSampleId || null }) : repo.createSample({ ...page, ...meta, parentSampleId: parentSampleId || undefined });
      } else record = id ? repo.update(id, Number(field(data, "revision")), page) : repo.create({ kind, ...page });
      return recordPath(record);
    });
  } catch (error) {
    return { error: error instanceof ConflictError ? error.message : "保存できませんでした。日付・種類・親試料（循環不可）と保存先を確認してください。" };
  }
  revalidatePath("/", "layout");
  if (id) return { success: "保存しました。" };
  redirect(path);
}
export async function addReference(_state: FormState, data: FormData): Promise<FormState> {
  try {
    withResearch(repo => {
      const entryId = field(data, "entryId");
      const entry = repo.list("entry").find(r => r.id === entryId);
      if (!entry) throw new Error("日次記録が見つかりません。");
      const targetId = field(data, "targetId");
      const target = repo.list().find(r => r.id === targetId);
      if (!target || !["protocol", "sample"].includes(target.kind)) throw new Error("参照先が見つかりません。");
      if (target.kind === "sample") repo.link(entryId, targetId);
      else {
        const versionId = field(data, "versionId");
        if (!repo.detail(targetId).versions.some(v => v.id === versionId)) throw new Error("版が見つかりません。");
        repo.useProtocol(entryId, versionId, field(data, "changes"));
      }
    });
    revalidatePath("/", "layout");
    return { success: "参照を追加しました。" };
  } catch { return { error: "参照を追加できませんでした。同じ版の重複や参照先を確認してください。" }; }
}
