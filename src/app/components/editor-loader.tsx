"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { ResearchRecord } from "@/server/research";
import type { Block } from "@/server/db/schema";

const Editor = dynamic(() => import("./research-editor"), { ssr: false, loading: () => <p>エディタを読み込み中…</p> });
export type Draft = { revision: number; body: Block[] };
export function EditorLoader({ record }: { record: ResearchRecord }) {
  const [draft, setDraft] = useState<Draft | null>();
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`labnote-draft:${record.id}`);
      const data = raw ? JSON.parse(raw) : null;
      setDraft(data && Number.isSafeInteger(data.revision) && Array.isArray(data.body) ? data : null);
    } catch { setDraft(null); }
  }, [record.id]);
  if (draft === undefined) return <p>下書きを確認中…</p>;
  return <Editor key={record.id} record={record} draft={draft} />;
}
