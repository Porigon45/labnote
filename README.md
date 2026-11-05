# labnote

個人研究者向けの実験ノート。第1フェーズのM0〜M7を実装しています。
基本記録、ブロック編集と自動保存、版付きプロトコル、親子試料台帳、研究メモ、測定表・グラフ、写真・添付、検索・アーカイブ、日次バックアップを利用できます。

## 必要な環境

- WSL Ubuntu、Node.js 24 LTS、npm
- Windowsのブラウザ（ChromeまたはEdge）

## 起動

WSLのターミナルで実行します。

```bash
cd /home/porigon/projects/labnote
export PATH="$HOME/.local/share/labnote/node24/bin:$PATH"
node --version # v24.xを確認
npm ci
npm run db:migrate
npm run dev
```

Windowsのブラウザで <http://localhost:3000> を開いてください。停止はターミナルで `Ctrl+C`、再開は `npm run dev` です。WSLまたはPCを再起動した場合も同じコマンドで開始します。

この作業環境には検証用Node.js 24を `~/.local/share/labnote/node24` に配置しています。他の環境では先にNode.js 24を導入してください。

本番ビルドを継続実行する場合:

```bash
npm run build
bash scripts/start-local.sh
```

開発・本番とも `127.0.0.1` にのみ接続を受け付けます。同時に同じポートで起動しないでください。
起動時にマイグレーションと当日分のバックアップを実行します。ターミナルを開いたまま利用し、停止は `Ctrl+C` です。PC・WSL再起動後は上記ディレクトリで `bash scripts/start-local.sh` を実行します。コードを変更しなければ再ビルドは不要です。実際のPC再起動は自動検証していません。

## 基本的な使い方

1. サイドバーの「プロジェクト」を開き、タイトルと状態を入力して作成します。
2. プロジェクト詳細の「新しい実験シリーズ」から実験を作成します。
3. 実験シリーズ詳細の「新しい日次記録」でタイトル・日付・状態を入力します。日付の初期値は日本時間の当日です。
4. 日次記録で基本情報を変更し、「変更を保存」を押します。保存は明示操作です。
5. パンくず、一覧、ダッシュボードの最近の記録から戻れます。各詳細ページのURLを保存して直接開くこともできます。

本文は編集後に自動保存されます。「再送待ち」では下書きを同じブラウザに保持し、通信復帰後に再送します。競合時は自動上書きを止めるため、下書きをダウンロードしてから最新内容を開いてください。基本情報は「変更を保存」で明示保存します。

日次記録はシリーズ内では日付順、ダッシュボードでは更新順に表示します。検索ではタグや所属、日付、状態を絞り込めます。アーカイブ済みの親に属する記録も通常画面から除外し、「アーカイブ」画面から復元できます。

## 保存先

環境変数を設定しなくても起動できます。変更する場合は `.env.example` を参考に `.env.local` を作成してください。マイグレーションCLIもNext.jsと同じ環境変数ファイルを読み込みます。本番用の設定は `NODE_ENV=production npm run db:migrate` で適用します。

| 変数 | 既定値 | 用途 |
| --- | --- | --- |
| `LABNOTE_DATA_DIR` | `./data` | SQLite本体（`labnote.sqlite`） |
| `LABNOTE_ATTACHMENTS_DIR` | データディレクトリ内の `attachments` | 添付保存先 |
| `LABNOTE_BACKUP_DIR` | `./backups` | 将来のバックアップ保存先 |

相対パスはプロジェクトルート基準です。データや添付はソースコード、`public`、ビルド先とは分離し、バックアップ先はデータ・添付の外に指定します。保存先をプロジェクト外へ変更した場合も、個人データをGitへ追加しないでください。

添付は1ファイル100MB・合計10GBまでです。`npm run attachments:audit` でDBと添付本体の不整合を検査できます。マイグレーションは既存データを保持したまま再実行できます。

## バックアップと復元

`dev` / `start` は起動時と動作中の毎分、日本時間の当日分があるか確認して、なければバックアップを作成します。停止中の時刻には実行せず、次の起動時に実行します。直近7日分と週次4世代を共用する最大11スナップショットを保持します。失敗したスナップショットは確定せず、過去の正常なバックアップを維持します。「保存とバックアップ」画面で容量と当日分の有無を確認できます。

本番設定で手動作成・一覧確認:

```bash
NODE_ENV=production npm run backup:create
NODE_ENV=production npm run backup:list
```

復元時はアプリを停止し、一覧に出たスナップショットの絶対パスと、新しい空の復元先を指定します。

```bash
NODE_ENV=production npm run backup:restore -- "/path/to/backups/snapshot-..." "/home/porigon/labnote-restored"
```

SHA-256・サイズ・SQLite整合性・必要な添付を検証してから、復元先に `data/labnote.sqlite` と `data/attachments` を作成します。既存データへの上書きは拒否します。復元コマンドが出力した `dataDir`・`attachmentsDir`・`backupDir` を `.env.local`（本番専用の設定ファイルを使っていればそちら）に設定し、`bash scripts/start-local.sh` で起動してください。元の保存先は確認が済むまで保持してください。

バックアップも同じPCにあるため、PCやディスクそのものの故障への備えには、確定したスナップショット一式を別媒体にも保管してください。下書きのlocalStorageはバックアップ対象外です。

`GET /api/health` はSQLite接続成功時に `{"status":"ok","database":"ok"}`、接続失敗時にHTTP 503を返します。

## 検証

```bash
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run benchmark
npm run build
npm run verify:production
```

Linuxの共有ライブラリ不足を報告された場合は `npx playwright install --with-deps chromium` でブラウザ依存を導入してください。

単体テストは一時ディレクトリにSQLiteを作成して終了時に削除します。E2Eは専用DBをマイグレーションしてから `127.0.0.1:3100` に専用サーバーを起動し、`.next-e2e` と `test-results/storage` を使用します。通常のデータには触れません。
`benchmark` は一時DBに500記録を生成して保存層の応答を測定します。`verify:production` は500記録と写真・参照を持つ一時DBで `127.0.0.1:3200` に本番サーバーを起動し、表示・停止/再起動・別保存先への復元を確認して終了時に削除します。3200番を空けて実行してください。

## 開発計画

- [全体計画](initial_plan.md)
- [PC版の情報・画面構成](docs/plans/2026-11-05-pc-note-structure.md)
- [第1フェーズのマイルストーン](docs/plans/2026-11-05-phase1-milestones.md)
- [M1のデータ構成・保存層](docs/development/m1-data-model.md)
- [M2の画面・基本記録フローと検証](docs/development/m2-record-flow.md)
- [M3のブロック編集と自動保存](docs/development/block-editor-autosave.md)
- [M4のプロトコル・試料・研究メモ](docs/development/research-references.md)
- [M5の測定表・グラフ・添付](docs/development/measurements-attachments.md)
- [M6の検索・リンク・アーカイブ](docs/development/search-links-archive.md)
- [M7の信頼性・バックアップと検証](docs/development/backup-reliability.md)
- [第1フェーズの受け入れチェックリスト](docs/development/phase1-acceptance.md)
