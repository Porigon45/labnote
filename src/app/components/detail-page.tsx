import { notFound } from "next/navigation";
import { EntryContent as EditorLoader } from "./entry-content";
import Link from "next/link";
import { Workspace, RecordList } from "./workspace";
import { RecordForm } from "./record-form";
import { kindLabels, recordPath, statusLabels, today, withResearch, type FlowKind } from "@/server/research";

export function DetailPage({ id, kind }: { id: string; kind: FlowKind }) {
  const all = withResearch(repo => repo.list());
  const record = all.find(r => r.id === id && r.kind === kind);
  if (!record) notFound();
  const ancestors = [];
  let parent = all.find(r => r.id === record.parentId);
  while (parent) { ancestors.unshift(parent); parent = all.find(r => r.id === parent!.parentId); }
  const children = all.filter(r => r.parentId === id).sort((a, b) => (b.date ?? b.updatedAt).localeCompare(a.date ?? a.updatedAt) || a.id.localeCompare(b.id));
  const childKind = kind === "project" ? "series" : "entry";
  const info = <><h2>記録の情報</h2><dl><dt>種類</dt><dd>{kindLabels[kind]}</dd><dt>状態</dt><dd>{statusLabels[record.status]}</dd>{record.date && <><dt>記録日</dt><dd>{record.date}</dd></>}<dt>作成日時</dt><dd>{new Date(record.createdAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</dd><dt>更新日時</dt><dd>{new Date(record.updatedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</dd></dl>{ancestors.length > 0 && <><div className="info-divider" /><h3>所属</h3>{ancestors.map(a => <p key={a.id}><Link href={recordPath(a)}>{a.title}</Link></p>)}</>}</>;
  return <Workspace section={kind === "project" ? "projects" : "series"} crumbs={[{ title: "プロジェクト", href: "/projects" }, ...ancestors.map(a => ({ title: a.title, href: recordPath(a) })), { title: record.title }]} info={info}>
    <div className="page-heading"><div><p className="eyebrow">{kindLabels[kind]}</p><h1>{record.title}</h1><p className="subtitle">{record.date ? `${record.date} · ` : ""}{statusLabels[record.status]}</p></div></div>
    {kind === "entry" ? <><section className="panel"><h2>記録の基本情報</h2><RecordForm key={record.id} kind="entry" record={record} /></section><section className="panel entry-body"><h2>実験記録</h2><EditorLoader record={record} /></section></> : <><section className="panel"><div className="section-heading"><h2>{kind === "project" ? "実験シリーズ" : "日次記録"}</h2><span>{children.length}件{kind === "series" ? " · 日付の新しい順" : ""}</span></div><RecordList records={children} empty={`${kindLabels[childKind]}はまだありません。下のフォームから作成できます。`} /></section><section className="panel"><h2>新しい{kindLabels[childKind]}</h2><RecordForm kind={childKind} parentId={id} initialDate={today()} /></section></>}
  </Workspace>;
}
