import { notFound } from "next/navigation";
import { bodyText } from "@/lib/content";
import Link from "next/link";
import { collections, type Collection } from "@/lib/library";
import { recordPath, today, withResearch } from "@/server/research";
import { Workspace, RecordList } from "../../components/workspace";
import { LibraryForm } from "../../components/library-form";
import { EditorLoader } from "../../components/editor-loader";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ collection: string; id: string }> }) {
  const { collection, id } = await params;
  if (!Object.hasOwn(collections, collection)) notFound();
  const selected = collection as Collection;
  const config = collections[selected];
  const data = withResearch(repo => { const all = repo.list(); return all.some(r => r.id === id && r.kind === config.kind) ? { all, record: repo.detail(id) } : null; });
  if (!data) notFound();
  const { all, record } = data;
  const parent = all.find(r => r.id === record.sample?.parentSampleId);
  const derived = all.filter(r => record.derivedSamples.some(s => s.recordId === r.id));
  const uses = all.filter(r => record.backlinks.some(b => b.sourceId === r.id));
  return <Workspace section={selected} crumbs={[{ title: config.title, href: `/${collection}` }, { title: record.title }]} info={<><h2>関連情報</h2><p>{record.category}</p>{parent && <p>親試料: <Link href={recordPath(parent)}>{parent.title}</Link></p>}<p>{record.sample?.location}</p></>}><div className="page-heading"><h1>{record.title}</h1></div><section className="panel"><h2>基本情報</h2><LibraryForm record={record} sample={record.sample} samples={all.filter(r => r.kind === "sample")} collection={selected} date={today()} /></section>
    {selected !== "samples" && <section className="panel"><h2>本文</h2><EditorLoader record={record} /></section>}
    {selected === "protocols" && <section className="panel"><h2>プロトコルの版履歴</h2>{record.versions.map(v => <details key={v.id}><summary>第{v.version}版 · {v.title} · {v.createdAt}</summary><pre className="snapshot-text">{bodyText(v.body) || "本文なし"}</pre></details>)}</section>}
    {selected === "samples" && <><section className="panel"><h2>派生試料</h2><RecordList records={derived} empty="派生試料はありません。" /></section><section className="panel"><h2>使用した実験</h2><RecordList records={uses} empty="参照する実験はありません。" /></section></>}
  </Workspace>;
}
