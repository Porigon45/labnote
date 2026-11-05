# labnote

個人研究者向けの実験ノート。M3（ブロック編集と自動保存）まで実装しています。
ダッシュボード、プロジェクト・実験シリーズの一覧と詳細、日次記録の作成・基本情報の編集、本文のブロック編集と自動保存を利用できます。

## 必要な環境

- WSL Ubuntu、Node.js 24 LTS、npm
- Windowsのブラウザ（ChromeまたはEdge）

## 起動

WSLのターミナルで実行します。

```bash
cd /home/porigon45/documents/labnote
npm ci
npm run db:migrate
npm run dev
```

Windowsのブラウザで <http://localhost:3000> を開いてください。停止はターミナルで `Ctrl+C`、再開は `npm run dev` です。WSLまたはPCを再起動した場合も同じコマンドで開始します。

本番ビルドを実行する場合:

```bash
npm run build
npm run start
```

開発・本番とも `127.0.0.1` にのみ接続を受け付けます。同時に同じポートで起動しないでください。

## 基本的な使い方

1. サイドバーの「プロジェクト」を開き、タイトルと状態を入力して作成します。
2. プロジェクト詳細の「新しい実験シリーズ」から実験を作成します。
3. 実験シリーズ詳細の「新しい日次記録」でタイトル・日付・状態を入力します。日付の初期値は日本時間の当日です。
4. 日次記録で基本情報を変更し、「変更を保存」を押します。保存は明示操作です。
5. パンくず、一覧、ダッシュボードの最近の記録から戻れます。各詳細ページのURLを保存して直接開くこともできます。

日次記録はシリーズ内では日付順、ダッシュボードでは更新順に表示します。アーカイブ済みの親に属する記録も通常画面から除外します。アーカイブ操作自体はM6で追加します。

## 保存先

環境変数を設定しなくても起動できます。変更する場合は `.env.example` を参考に `.env.local` を作成してください。マイグレーションCLIもNext.jsと同じ環境変数ファイルを読み込みます。本番用の設定は `NODE_ENV=production npm run db:migrate` で適用します。

| 変数 | 既定値 | 用途 |
| --- | --- | --- |
| `LABNOTE_DATA_DIR` | `./data` | SQLite本体（`labnote.sqlite`） |
| `LABNOTE_ATTACHMENTS_DIR` | データディレクトリ内の `attachments` | 添付保存先 |
| `LABNOTE_BACKUP_DIR` | `./backups` | 将来のバックアップ保存先 |

相対パスはプロジェクトルート基準です。データや添付はソースコード、`public`、ビルド先とは分離し、バックアップ先はデータ・添付の外に指定します。保存先をプロジェクト外へ変更した場合も、個人データをGitへ追加しないでください。

添付アップロードはM5、自動バックアップと復元はM7で実装します。マイグレーションはDrizzleの履歴と研究データのテーブルを作成します。既存データを保持したまま再実行できます。

`GET /api/health` はSQLite接続成功時に `{"status":"ok","database":"ok"}`、接続失敗時にHTTP 503を返します。

## 検証

```bash
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
```

Linuxの共有ライブラリ不足を報告された場合は `npx playwright install --with-deps chromium` でブラウザ依存を導入してください。

単体テストは一時ディレクトリにSQLiteを作成して終了時に削除します。E2Eは専用DBをマイグレーションしてから `127.0.0.1:3100` に専用サーバーを起動し、`.next-e2e` と `test-results/storage` を使用します。通常のデータには触れません。

## 開発計画

- [全体計画](initial_plan.md)
- [PC版の情報・画面構成](docs/plans/2026-11-05-pc-note-structure.md)
- [第1フェーズのマイルストーン](docs/plans/2026-11-05-phase1-milestones.md)
- [M1のデータ構成・保存層](docs/development/m1-data-model.md)
- [M2の画面・基本記録フローと検証](docs/development/m2-record-flow.md)
