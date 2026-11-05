"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordPath, withResearch } from "@/server/research";
import type { FormState } from "./actions";
export async function organizeRecord(_state: FormState, data: FormData): Promise<FormState> {
  const id = String(data.get("id") ?? "");
  const command = String(data.get("command") ?? "");
  let path = "";
  try {
    withResearch(repo => {
      const archived = command === "restore";
      const record = repo.list(undefined, undefined, archived).find(r => r.id === id);
      if (!record) throw new Error();
      if (command === "archive" || command === "restore") {
        repo.setArchived(id, Number(data.get("revision")), command === "archive");
        path = command === "archive" || (record.parentId && repo.list(undefined, undefined, true).some(r => r.id === record.parentId)) ? "/archive" : recordPath(record);
      } else if (command === "tags") repo.setTags(id, String(data.get("tags") ?? "").split(","));
      else if (command === "link") {
        const target = String(data.get("target") ?? "");
        if (!repo.list().some(r => r.id === target)) throw new Error();
        repo.link(id, target);
      } else throw new Error();
    });
  } catch { return { error: "操作できませんでした。最新の状態を確認して再試行してください。" }; }
  revalidatePath("/", "layout");
  if (path) redirect(path);
  return { success: "保存しました。" };
}
