import Link from "next/link";
import { Workspace } from "./components/workspace";
export default function NotFound() {
  return <Workspace><section className="panel"><h1>記録が見つかりません</h1><p className="subtitle">URLを確認するか、一覧から記録を選び直してください。</p><Link className="button" href="/projects">プロジェクトへ戻る</Link></section></Workspace>;
}
