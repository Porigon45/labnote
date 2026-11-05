"use client";

import { useActionState, useState } from "react";
import { saveRecord } from "../actions";
import type { FlowKind, ResearchRecord } from "@/server/research";

export function RecordForm({ kind, parentId, initialDate, record }: {
  kind: FlowKind; parentId?: string; initialDate?: string; record?: ResearchRecord;
}) {
  const [state, action, pending] = useActionState(saveRecord, {});
  const [title, setTitle] = useState(record?.title ?? "");
  const [date, setDate] = useState(record?.date ?? initialDate ?? "");
  const [status, setStatus] = useState(record?.status ?? "active");
  return <form action={action} className="record-form">
    <input type="hidden" name="kind" value={kind} />
    <input type="hidden" name="parentId" value={parentId ?? ""} />
    {record && <><input type="hidden" name="id" value={record.id} /><input type="hidden" name="revision" value={record.revision} /></>}
    <label>タイトル<input name="title" required maxLength={300} value={title} onChange={e => setTitle(e.target.value)} placeholder={kind === "project" ? "例：酵母のストレス応答" : kind === "series" ? "例：培養条件の比較" : "例：培養1日目の観察"} /></label>
    <div className="form-row">
      {kind === "entry" && <label>日付<input type="date" name="date" required value={date} onChange={e => setDate(e.target.value)} /></label>}
      <label>状態<select name="status" value={status} onChange={e => setStatus(e.target.value as typeof status)}><option value="planned">予定</option><option value="active">進行中</option><option value="completed">完了</option></select></label>
    </div>
    {state.error && <p role="alert" className="form-error">{state.error}</p>}
    {state.success && <p role="status" className="form-success">{state.success}</p>}
    <button type="submit" disabled={pending}>{pending ? "保存中…" : record ? "変更を保存" : "作成する"}</button>
  </form>;
}
