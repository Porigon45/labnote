import type { ResearchRepository } from "./repository";

/** Explicit test fixture only. Never called at application startup or by migrations. */
export function seedResearchFixture(repo: ResearchRepository) {
  const theme = repo.create({ kind: "theme", title: "テスト用研究テーマ" });
  const project = repo.create({ kind: "project", title: "テストプロジェクト", parentId: theme.id, purpose: "記録フローの確認" });
  const series = repo.create({ kind: "series", title: "生育記録", parentId: project.id, hypothesis: "条件により測定値が変わる" });
  const entry = repo.create({ kind: "entry", title: "測定1日目", parentId: series.id, date: "2026-11-05" });
  const protocol = repo.create({ kind: "protocol", title: "測定手順", body: [{ id: "step-1", type: "paragraph", content: "測定値を記録する" }] });
  const sample = repo.createSample({ title: "試料A", type: "strain", location: "テスト保管棚" });
  const derived = repo.createSample({ title: "試料A-1", type: "strain", parentSampleId: sample.id });
  const memo = repo.create({ kind: "memo", title: "装置メモ", category: "装置・操作Tips" });
  repo.link(entry.id, derived.id);
  repo.setTags(entry.id, ["測定", "テスト"]);
  repo.useProtocol(entry.id, repo.detail(protocol.id).versions[0].id, "変更なし");
  return { theme, project, series, entry, protocol, sample, derived, memo };
}
