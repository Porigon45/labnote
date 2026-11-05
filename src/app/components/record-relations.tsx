import { recordPath, withResearch, type ResearchRecord } from "@/server/research";
import { OrganizeForm } from "./organize-panel";
import { RecordList } from "./workspace";
export function RecordRelations({ record }: { record: ResearchRecord }) {
  const { all, detail } = withResearch(repo => ({ all: repo.list(), detail: repo.detail(record.id) }));
  return <section className="panel"><h2>タグ・リンク</h2><OrganizeForm id={record.id} revision={record.revision} command="tags" tags={detail.tags} /><div className="info-divider" /><OrganizeForm id={record.id} revision={record.revision} command="link" targets={all.map(r => ({ id: r.id, title: r.title }))} /><h3>関連ページ</h3><RecordList records={all.filter(r => detail.outgoing.some(l => l.targetId === r.id))} empty="関連ページはありません。" /><h3>この記録への参照</h3><RecordList records={all.filter(r => detail.backlinks.some(l => l.sourceId === r.id))} empty="参照元はありません。" /><div className="info-divider" /><OrganizeForm id={record.id} revision={record.revision} command="archive" /></section>;
}
