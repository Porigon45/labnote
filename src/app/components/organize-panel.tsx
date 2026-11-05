"use client";
import { useActionState } from "react";
import { organizeRecord } from "../organize-actions";
export function OrganizeForm({ id, revision, command, tags = [], targets = [] }: { id: string; revision: number; command: "archive" | "restore" | "tags" | "link"; tags?: string[]; targets?: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState(organizeRecord, {});
  return <form action={action} className="record-form" onSubmit={event => { if (["archive", "restore"].includes(command) && !confirm(command === "archive" ? "この記録をアーカイブしますか？配下の記録も通常一覧から非表示になります。" : "この記録を復元しますか？")) event.preventDefault(); }}><input type="hidden" name="id" value={id} /><input type="hidden" name="revision" value={revision} /><input type="hidden" name="command" value={command} />{command === "tags" && <label>タグ（カンマ区切り）<input name="tags" defaultValue={tags.join(", ")} /></label>}{command === "link" && <label>リンク先<select name="target">{targets.filter(t => t.id !== id).map(t => <option value={t.id} key={t.id}>{t.title}</option>)}</select></label>}{state.error && <p role="alert">{state.error}</p>}{state.success && <p role="status">{state.success}</p>}<button disabled={pending || command === "link" && targets.length < 2}>{command === "tags" ? "タグを保存" : command === "link" ? "リンクを追加" : command === "archive" ? "アーカイブする" : "復元する"}</button></form>;
}
