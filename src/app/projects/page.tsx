import { Workspace, RecordList } from "../components/workspace";
import { RecordForm } from "../components/record-form";
import { withResearch } from "@/server/research";

export const dynamic = "force-dynamic";
export default function Projects() {
  const projects = withResearch(repo => repo.list("project"));
  return <Workspace section="projects" crumbs={[{ title: "プロジェクト" }]}><div className="page-heading"><div><p className="eyebrow">PROJECTS</p><h1>プロジェクト</h1><p className="subtitle">研究テーマごとに実験を整理する。</p></div></div><section className="panel"><h2>プロジェクト一覧</h2><RecordList records={projects} empty="プロジェクトはまだありません。下のフォームから作成できます。" /></section><section className="panel"><h2>新しいプロジェクト</h2><RecordForm kind="project" /></section></Workspace>;
}
