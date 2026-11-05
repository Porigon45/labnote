"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { ResearchRecord } from "@/server/research";
import type { Block } from "@/server/db/schema";
import { blockTypes } from "@/lib/blocks";

const Editor = dynamic(() => import("./research-editor"), { ssr: false, loading: () => <p>エディタを読み込み中…</p> });
export type Draft = { revision: number; body: Block[] };
export function EditorLoader({ record }: { record: ResearchRecord }) {
  const [draft, setDraft] = useState<Draft | null>();
  const [problem, setProblem] = useState("");
  const [rawDraft, setRawDraft] = useState("");
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`labnote-draft:${record.id}`);
      setRawDraft(raw ?? "");
      const data = raw ? JSON.parse(raw) : null;
      const valid = (body: Block[]): boolean => Array.isArray(body) && body.every(b => b && typeof b.id === "string" && blockTypes.has(b.type) && (!b.children || valid(b.children as Block[])));
      if (data && (!Number.isSafeInteger(data.revision) || !valid(data.body))) { setProblem("下書きの形式を読み込めません。元データを保存してから、最新の記録を開いてください。"); return; }
      setDraft(data);
    } catch { setProblem("ブラウザの下書きを読み込めません。保存済みの記録を開く前に、下書きの元データを保管してください。"); }
  }, [record.id]);
  if (problem) return <div role="alert"><p>{problem}</p><button onClick={() => { const url = URL.createObjectURL(new Blob([rawDraft], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = "labnote-draft-recovery.json"; a.click(); URL.revokeObjectURL(url); }}>下書きの元データを保存</button><button onClick={() => { if (confirm("下書きを破棄して保存済みの記録を開きますか？")) { try { localStorage.removeItem(`labnote-draft:${record.id}`); } catch {} setProblem(""); setDraft(null); } }}>保存済みの記録を開く</button></div>;
  if (draft === undefined) return <p>下書きを確認中…</p>;
  return <Editor key={record.id} record={record} draft={draft} />;
}
