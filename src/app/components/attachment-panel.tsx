"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
type Attachment = { id: string; filename: string; mime: string; caption: string; bytes: number };
export async function uploadAttachment(recordId: string, file: File) {
  const response = await fetch(`/api/records/${recordId}/attachments?filename=${encodeURIComponent(file.name)}`, { method: "POST", body: file, headers: { "Content-Type": "application/octet-stream" } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "アップロードに失敗しました。");
  return result as Attachment & { url: string };
}
export function AttachmentPanel({ recordId, attachments }: { recordId: string; attachments: Attachment[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return <div className="attachment-panel"><h2>結果・写真・添付</h2><form className="record-form" onSubmit={async e => {
    e.preventDefault(); const form = e.currentTarget; const file = new FormData(form).get("file"); if (!(file instanceof File) || !file.name) return;
    setBusy(true); setMessage("");
    try { await uploadAttachment(recordId, file); form.reset(); setMessage("アップロードしました。"); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "保存に失敗しました。"); } finally { setBusy(false); }
  }}><label>添付ファイル<input type="file" name="file" required /></label><p className="muted">1ファイル100MB、合計10GBまで。画像・PDF・テキスト・CSV・Office・ZIP。</p><button disabled={busy}>{busy ? "アップロード中…" : "アップロード"}</button></form><p role="status" aria-label="添付の保存状態">{message}</p>
    {attachments.map(a => <figure key={a.id}>{a.mime.startsWith("image/") && <img src={`/api/attachments/${a.id}`} alt={a.caption || a.filename} className="attachment-image" />}<figcaption><a href={`/api/attachments/${a.id}?download=1`}>{a.filename} ↓</a> · {(a.bytes / 1024).toFixed(1)}KB</figcaption><form className="record-form" onSubmit={async e => { e.preventDefault(); const caption = String(new FormData(e.currentTarget).get("caption") ?? ""); try { const r = await fetch(`/api/attachments/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caption }) }); if (!r.ok) throw new Error("キャプションを保存できませんでした。"); setMessage("キャプションを保存しました。"); router.refresh(); } catch { setMessage("キャプションを保存できませんでした。"); } }}><label>キャプション<input name="caption" defaultValue={a.caption} maxLength={2000} /></label><button>キャプションを保存</button></form></figure>)}
  </div>;
}
