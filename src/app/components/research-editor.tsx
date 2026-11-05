"use client";
import { BlockNoteSchema, defaultBlockSpecs, type PartialBlock } from "@blocknote/core";
import { ja } from "@blocknote/core/locales";
import { BlockNoteView } from "@blocknote/mantine";
import { createReactBlockSpec, getDefaultReactSlashMenuItems, SuggestionMenuController, useCreateBlockNote } from "@blocknote/react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import katex from "katex";
import type { ResearchRecord } from "@/server/research";
import type { Block } from "@/server/db/schema";
import type { Draft } from "./editor-loader";
import "@blocknote/mantine/style.css";
import "katex/dist/katex.min.css";
import { measurementBlock } from "./measurement-block";
import { uploadAttachment } from "./attachment-panel";

const timestamp = createReactBlockSpec({ type: "timestamp", propSchema: { time: { default: "09:00" } }, content: "inline" }, {
  render: ({ block, editor, contentRef }) => <div className="timed-step"><input aria-label="操作時刻" type="time" value={block.props.time} onChange={e => editor.updateBlock(block, { props: { time: e.target.value } })} /><div ref={contentRef} /></div>,
})();
const math = createReactBlockSpec({ type: "math", propSchema: { formula: { default: "E=mc^2" } }, content: "none" }, {
  render: ({ block, editor }) => <div className="math-block"><label>数式<input aria-label="数式" value={block.props.formula} onChange={e => editor.updateBlock(block, { props: { formula: e.target.value } })} /></label><div dangerouslySetInnerHTML={{ __html: katex.renderToString(block.props.formula, { throwOnError: false, trust: false }) }} /></div>,
})();
const pageLink = createReactBlockSpec({ type: "pageLink", propSchema: { url: { default: "/projects" }, label: { default: "関連ページ" } }, content: "none" }, {
  render: ({ block, editor }) => <div className="page-link-block"><label>リンク先<input value={block.props.url} onChange={e => editor.updateBlock(block, { props: { url: e.target.value } })} /></label><label>表示名<input value={block.props.label} onChange={e => editor.updateBlock(block, { props: { label: e.target.value } })} /></label><a href={/^(\/|https?:\/\/)/.test(block.props.url) && !block.props.url.startsWith("//") ? block.props.url : "#"}>{block.props.label} ↗</a></div>,
})();
export const researchSchema = BlockNoteSchema.create({ blockSpecs: { ...defaultBlockSpecs, timestamp, math, pageLink, measurement: measurementBlock } });
const choices = { paragraph: "文章", heading: "見出し", bulletListItem: "箇条書き", numberedListItem: "番号リスト", checkListItem: "チェック", quote: "引用", codeBlock: "コード", math: "数式", table: "表", image: "画像", file: "ファイル", divider: "区切り", pageLink: "ページリンク", timestamp: "時刻付き手順", measurement: "測定表" } as const;

export default function ResearchEditor({ record, draft }: { record: ResearchRecord; draft: Draft | null }) {
  const router = useRouter();
  const [uploadError, setUploadError] = useState("");
  const editor = useCreateBlockNote({ schema: researchSchema, dictionary: ja, uploadFile: async file => { try { const a = await uploadAttachment(record.id, file); setUploadError(""); router.refresh(); return a.url; } catch (error) { setUploadError(error instanceof Error ? error.message : "アップロードに失敗しました。"); throw error; } }, initialContent: ((draft?.body ?? record.body).length ? (draft?.body ?? record.body) : undefined) as PartialBlock<typeof researchSchema.blockSchema>[] | undefined });
  const key = `labnote-draft:${record.id}`;
  const revision = useRef(draft?.revision ?? record.revision);
  const saved = useRef(JSON.stringify(record.body));
  const pending = useRef(draft ? JSON.stringify(draft.body) : null);
  const locked = useRef(Boolean(draft && draft.revision !== record.revision));
  const inFlight = useRef(false);
  const editedAt = useRef(0);
  const [status, setStatus] = useState(locked.current ? "競合：下書きを保管しています" : draft ? "再送待ち" : "保存済み");
  const [storageError, setStorageError] = useState(false);
  const [type, setType] = useState<keyof typeof choices>("paragraph");
  function store(body: string) {
    try { localStorage.setItem(key, JSON.stringify({ revision: revision.current, body: JSON.parse(body) })); setStorageError(false); }
    catch { setStorageError(true); }
  }
  useEffect(() => {
    if (!pending.current && JSON.stringify(record.body) === saved.current) revision.current = record.revision;
  }, [record.revision, record.body]);
  useEffect(() => {
    let mounted = true;
    async function flush() {
      if (!pending.current || locked.current || inFlight.current || Date.now() - editedAt.current < 700) return;
      inFlight.current = true;
      const body = pending.current;
      setStatus("保存中");
      try {
        const response = await fetch(`/api/records/${record.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: revision.current, body: JSON.parse(body) }) });
        if (response.status === 409) { locked.current = true; throw new Error("競合：下書きを保管しています"); }
        if (!response.ok) throw new Error("再送待ち");
        const result = await response.json();
        revision.current = result.revision;
        saved.current = body;
        if (pending.current === body) { pending.current = null; try { localStorage.removeItem(key); } catch { setStorageError(true); } }
        else store(pending.current!);
        if (mounted) { setStatus(pending.current ? "保存中" : "保存済み"); router.refresh(); }
      } catch (error) {
        editedAt.current = Date.now() + 2000;
        if (mounted) setStatus(error instanceof Error ? error.message : "再送待ち");
      } finally { inFlight.current = false; }
    }
    const timer = setInterval(flush, 500);
    const warn = (event: BeforeUnloadEvent) => { if (pending.current) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("online", flush);
    return () => { mounted = false; clearInterval(timer); window.removeEventListener("beforeunload", warn); window.removeEventListener("online", flush); };
  }, [record.id, key, router]);
  function insert(blockType: keyof typeof choices) {
    let block: PartialBlock<typeof researchSchema.blockSchema> = { type: blockType };
    if (blockType === "timestamp") block = { type: "timestamp", props: { time: new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" }) } };
    if (blockType === "table") block = { type: "table", content: { type: "tableContent", rows: [{ cells: ["時刻", "値"] }, { cells: ["", ""] }] } };
    const added = editor.insertBlocks([block], editor.getTextCursorPosition().block, "after");
    editor.setTextCursorPosition(added[0], "end"); editor.focus();
  }
  function duplicate() {
    const block = editor.getTextCursorPosition().block;
    const stripIds = (value: unknown): unknown => Array.isArray(value) ? value.map(stripIds) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== "id").map(([key, v]) => [key, stripIds(v)])) : value;
    editor.insertBlocks([stripIds(block) as PartialBlock<typeof researchSchema.blockSchema>], block, "after");
  }
  return <div className="research-editor">
    {uploadError && <p role="alert">{uploadError}</p>}
    <div className="editor-toolbar"><label>ブロック<select aria-label="追加するブロック" value={type} onChange={e => setType(e.target.value as typeof type)}>{Object.entries(choices).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button onClick={() => insert(type)}>追加</button><button onClick={() => editor.moveBlocksUp()}>上へ</button><button onClick={() => editor.moveBlocksDown()}>下へ</button><button onClick={duplicate}>複製</button><span role="status" aria-label="本文の保存状態">{status}</span></div>
    {storageError && <p role="alert">ブラウザ内に下書きを保持できません。保存済みになるまで画面を閉じないでください。</p>}
    {status.startsWith("競合") && <div className="form-error"><p>別の保存があります。下書きをコピーしてから最新の記録を開いてください。</p><button onClick={() => { const blob = new Blob([pending.current ?? "[]"], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "labnote-draft.json"; a.click(); URL.revokeObjectURL(url); }}>下書きをダウンロード</button><button onClick={() => { if (confirm("未送信の下書きを破棄し、最新の記録を開きますか？")) { localStorage.removeItem(key); location.reload(); } }}>最新の記録を開く</button></div>}
    <BlockNoteView editor={editor} theme="light" slashMenu={false} onChange={() => { const body = JSON.stringify(editor.document); if (body === saved.current && !pending.current) return; pending.current = body; editedAt.current = Date.now(); store(body); if (!locked.current) setStatus("保存中"); }}>
      <SuggestionMenuController triggerCharacter="/" getItems={async query => [...getDefaultReactSlashMenuItems(editor), ...(["timestamp", "math", "pageLink", "measurement"] as const).map(t => ({ title: choices[t], group: "研究", onItemClick: () => insert(t), aliases: [t] }))].filter(i => i.title.toLowerCase().includes(query.toLowerCase()) || i.aliases?.some(a => a.includes(query)))} />
    </BlockNoteView>
  </div>;
}
