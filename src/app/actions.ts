"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ConflictError } from "@/server/db/repository";
import { recordPath, withResearch, type FlowKind } from "@/server/research";

export type FormState = { error?: string; success?: string };
function value(data: FormData, key: string) {
  const input = data.get(key);
  return typeof input === "string" ? input : "";
}
export async function saveRecord(_state: FormState, data: FormData): Promise<FormState> {
  const kind = value(data, "kind") as FlowKind;
  if (!["project", "series", "entry"].includes(kind)) return { error: "記録の種類が不正です。" };
  const title = value(data, "title").trim();
  const date = value(data, "date");
  const status = value(data, "status");
  if (!title) return { error: "タイトルを入力してください。" };
  if (!["planned", "active", "completed"].includes(status)) return { error: "状態を選択してください。" };
  if (kind === "entry" && !date) return { error: "日付を入力してください。" };
  const id = value(data, "id");
  let path: string;
  try {
    path = withResearch(repo => {
      const patch = { title, status: status as "planned" | "active" | "completed", ...(kind === "entry" ? { date } : {}) };
      // Includes archive flags inherited from parent projects and series.
      const visible = repo.list();
      if (id) {
        const existing = visible.find(r => r.id === id && r.kind === kind);
        if (!existing || kind !== "entry") throw new Error("編集対象の記録が見つかりません。");
        return recordPath(repo.update(id, Number(value(data, "revision")), patch));
      }
      const parentId = value(data, "parentId");
      const parentKind = kind === "series" ? "project" : "series";
      if (kind !== "project" && !visible.some(r => r.id === parentId && r.kind === parentKind)) {
        throw new Error("作成先が見つかりません。ページを再読み込みしてください。");
      }
      return recordPath(repo.create({ kind, ...patch, ...(kind === "project" ? {} : { parentId }) }));
    });
  } catch (error) {
    if (error instanceof ConflictError) return { error: error.message };
    if (error instanceof Error && /^(日付|タイトル|作成先|編集対象)/.test(error.message)) return { error: error.message };
    console.error("Record save failed", error);
    return { error: "保存できませんでした。入力内容を確認して、もう一度お試しください。" };
  }
  revalidatePath("/", "layout");
  if (id) return { success: "保存しました。" };
  redirect(path);
}
