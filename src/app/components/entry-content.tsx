import Link from "next/link";
import { EditorLoader } from "./editor-loader";
import { ReferenceForm } from "./reference-form";
import { bodyText } from "@/lib/content";
import { recordPath, withResearch, type ResearchRecord } from "@/server/research";
export function EntryContent({ record }: { record: ResearchRecord }) {
  const data = withResearch(repo => ({ detail: repo.detail(record.id), all: repo.list(), targets: repo.list().filter(r => ["protocol", "sample"].includes(r.kind)).map(r => ({ id: r.id, title: r.title, versions: r.kind === "protocol" ? repo.detail(r.id).versions.map(v => ({ id: v.id, version: v.version })) : [] })) }));
  const samples = data.all.filter(r => r.kind === "sample" && data.detail.outgoing.some(l => l.targetId === r.id));
  return <><EditorLoader record={record} /><div className="info-divider" /><h2>使用試料・プロトコル</h2>{samples.map(s => <p key={s.id}><Link href={recordPath(s)}>{s.title} →</Link></p>)}{data.detail.protocols.map(({ snapshot, version }) => <details key={snapshot.id}><summary>{version.title} · 第{version.version}版（使用時の内容）</summary><pre className="snapshot-text">{bodyText(version.body) || "本文なし"}</pre><p>変更点: {snapshot.changes || "なし"}</p><Link href={`/protocols/${version.protocolId}`}>元プロトコルへ →</Link></details>)}<ReferenceForm entryId={record.id} targets={data.targets} /></>;
}
