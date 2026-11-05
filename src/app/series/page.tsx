import { Workspace, RecordList } from "../components/workspace";
import { withResearch } from "@/server/research";

export const dynamic = "force-dynamic";
export default function Series() {
  const all = withResearch(repo => repo.list());
  return <Workspace section="series" crumbs={[{ title: "実験シリーズ" }]}><div className="page-heading"><div><p className="eyebrow">EXPERIMENT SERIES</p><h1>実験シリーズ</h1><p className="subtitle">一連の実験と、日々の記録をたどる。</p></div></div><section className="panel"><h2>実験シリーズ一覧</h2><RecordList records={all.filter(r => r.kind === "series")} allRecords={all} empty="実験シリーズはまだありません。プロジェクトの詳細から作成できます。" /></section></Workspace>;
}
