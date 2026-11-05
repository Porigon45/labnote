import { notFound } from "next/navigation";
import { collections, memoCategories, type Collection } from "@/lib/library";
import { today, withResearch } from "@/server/research";
import { Workspace, RecordList } from "../components/workspace";
import { LibraryForm } from "../components/library-form";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function Page({ params, searchParams }: { params: Promise<{ collection: string }>; searchParams: Promise<{ category?: string }> }) {
  const { collection } = await params;
  if (!Object.hasOwn(collections, collection)) notFound();
  const selected = collection as Collection;
  const config = collections[selected];
  const category = (await searchParams).category;
  const all = withResearch(repo => repo.list());
  const records = all.filter(r => r.kind === config.kind && (selected !== "memos" || !category || r.category === category));
  return <Workspace section={selected} crumbs={[{ title: config.title }]}><div className="page-heading"><h1>{config.title}</h1></div>{selected === "memos" && <div className="category-links"><Link href="/memos">すべて</Link>{memoCategories.map(c => <Link key={c} href={`/memos?category=${encodeURIComponent(c)}`}>{c}</Link>)}</div>}<section className="panel"><h2>一覧</h2><RecordList records={records} empty="まだ登録されていません。下のフォームから作成できます。" /></section><section className="panel"><h2>新規作成</h2><LibraryForm collection={selected} samples={all.filter(r => r.kind === "sample")} date={today()} /></section></Workspace>;
}
