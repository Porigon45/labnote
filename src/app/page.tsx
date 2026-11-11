import Link from "next/link";
import { Workspace, RecordList } from "./components/workspace";
import { withResearch } from "@/server/research";

export const dynamic = "force-dynamic";
export default function Home() {
  const all = withResearch(repo => repo.list());
  const entries = all.filter(r => r.kind === "entry");
  const active = all.filter(r => r.kind === "series" && r.status === "active");
  return <Workspace><div className="page-heading"><h1>実験ノート</h1><Link className="button" href="/projects">プロジェクトを開く</Link></div>
    <div className="stats"><Link href="/projects"><strong>{all.filter(r => r.kind === "project").length}</strong><span>プロジェクト</span></Link><Link href="/series"><strong>{active.length}</strong><span>進行中の実験</span></Link><div><strong>{entries.length}</strong><span>日次記録</span></div></div>
    <section className="panel"><div className="section-heading"><h2>最近の記録</h2><span>更新順</span></div><RecordList records={entries.slice(0, 8)} allRecords={all} empty="日次記録はまだありません。プロジェクトから記録を始めましょう。" /></section>
    <section className="panel"><div className="section-heading"><h2>進行中の実験</h2><Link href="/series">すべて見る →</Link></div><RecordList records={active.slice(0, 5)} allRecords={all} empty="進行中の実験シリーズはありません。" /></section>
  </Workspace>;
}
