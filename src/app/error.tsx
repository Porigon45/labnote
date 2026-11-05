"use client";
import Link from "next/link";
export default function Error({ retry }: { error: unknown; retry: () => void }) {
  return <main><section className="panel" role="alert"><h1>記録を表示できませんでした</h1><p className="subtitle">未送信の下書きは同じブラウザに残っています。保存先や空き容量を確認して再試行してください。</p><div className="editor-toolbar"><button onClick={retry}>再試行</button><Link href="/">ホームへ</Link></div></section></main>;
}
