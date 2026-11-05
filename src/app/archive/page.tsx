import { withResearch } from "@/server/research";
import { Workspace } from "../components/workspace";
import { OrganizeForm } from "../components/organize-panel";
export const dynamic = "force-dynamic";
export default function Page() {
  const archived = withResearch(repo => repo.list(undefined, undefined, true));
  return <Workspace section="archive" crumbs={[{ title: "アーカイブ" }]}><div className="page-heading"><h1>アーカイブ</h1></div><section className="panel">{!archived.length && <p>アーカイブされた記録はありません。</p>}{archived.map(r => <article key={r.id} className="search-result"><h2>{r.title}</h2>{r.archivedAt ? <OrganizeForm id={r.id} revision={r.revision} command="restore" /> : <p className="muted">親のプロジェクトまたは実験シリーズを復元すると表示されます。</p>}</article>)}</section></Workspace>;
}
