import { existsSync, statfsSync, statSync } from "node:fs";
import { getStorageConfig } from "@/server/config";
import { auditAttachments, TOTAL_LIMIT } from "@/server/attachments";
import { listBackups } from "@/server/backup";
import { today } from "@/server/research";
import { Workspace } from "../components/workspace";
export const dynamic = "force-dynamic";
const size = (bytes: number) => `${(bytes / 1024 ** 2).toFixed(1)} MB`;
export default function Page() {
  const config = getStorageConfig();
  const audit = auditAttachments(config);
  const backups = listBackups(config);
  const free = statfsSync(config.dataDir);
  const latest = backups[0]?.manifest.createdAt;
  const latestDay = latest ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date(latest)) : "";
  return <Workspace crumbs={[{ title: "保存とバックアップ" }]}><div className="page-heading"><h1>保存とバックアップ</h1></div><section className="panel"><h2>保存容量</h2><dl><dt>SQLite</dt><dd>{size(existsSync(config.databasePath) ? statSync(config.databasePath).size : 0)}</dd><dt>添付</dt><dd>{size(audit.bytes)} / {size(TOTAL_LIMIT)}</dd><dt>保存先ディスクの空き</dt><dd>{size(free.bavail * free.bsize)}</dd></dl><progress max={TOTAL_LIMIT} value={audit.bytes} aria-label="添付の使用容量" /><p className="muted">データと添付はこのPC内に保存します。</p></section><section className="panel"><h2>添付の整合性</h2><p>{audit.missing.length || audit.mismatched.length || audit.orphaned.length ? "不整合があります。attachments:audit の結果とバックアップを確認してください。" : "添付の不整合はありません。"}</p><p className="subtitle">本体の欠損 {audit.missing.length}件 / サイズ不一致 {audit.mismatched.length}件 / 未登録ファイル {audit.orphaned.length}件</p></section><section className="panel"><h2>日次バックアップ</h2><p>{latestDay === today() ? "本日のバックアップがあります。" : "本日のバックアップがありません。アプリ起動中に再試行します。必要なら backup:create を実行してください。"}</p><p className="subtitle">直近7日分と週次4世代を保持します。同じスナップショットが両方に含まれる場合は共用します。</p><ul>{backups.map(b => <li key={b.directory}>{new Date(b.manifest.createdAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })} · {size(b.manifest.files.reduce((n, f) => n + f.bytes, 0))}</li>)}</ul><p className="muted">復元はアプリを止め、READMEの手順に従って新しい空の保存先へ実行してください。</p></section></Workspace>;
}
