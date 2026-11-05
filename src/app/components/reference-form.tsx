"use client";
import { useActionState, useState } from "react";
import { addReference } from "../library-actions";
export function ReferenceForm({ entryId, targets }: { entryId: string; targets: { id: string; title: string; versions: { id: string; version: number }[] }[] }) {
  const [state, action, pending] = useActionState(addReference, {});
  const [id, setId] = useState(targets[0]?.id ?? "");
  const target = targets.find(t => t.id === id);
  if (!targets.length) return <p className="muted">試料台帳またはプロトコルを作成すると参照できます。</p>;
  return <form action={action} className="record-form"><input type="hidden" name="entryId" value={entryId} /><label>参照先<select name="targetId" value={id} onChange={e => setId(e.target.value)}>{targets.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>{!!target?.versions.length && <><label>使用する版<select key={id} name="versionId">{target.versions.map(v => <option key={v.id} value={v.id}>第{v.version}版</option>)}</select></label><label>手順の変更点<textarea name="changes" rows={3} /></label></>}{state.error && <p role="alert">{state.error}</p>}{state.success && <p role="status">{state.success}</p>}<button disabled={pending}>参照を追加</button></form>;
}
