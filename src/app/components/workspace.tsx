import Link from "next/link";
import { BookMarked, FileText, FlaskConical, FolderOpen, LayoutDashboard, Monitor, Sprout, TestTubes } from "lucide-react";
import { recordPath, statusLabels, type ResearchRecord } from "@/server/research";

export function Workspace({ children, section = "home", crumbs = [], info }: {
  children: React.ReactNode; section?: "home" | "projects" | "series" | "protocols" | "samples" | "memos" | "search" | "archive";
  crumbs?: { title: string; href?: string }[]; info?: React.ReactNode;
}) {
  return <div className="workspace">
    <a className="skip-link" href="#main-content">本文へ移動</a>
    <aside className="sidebar" aria-label="ワークスペース">
      <Link className="brand" href="/" aria-label="labnote ホーム"><Sprout size={25} aria-hidden="true" /><span>labnote.</span></Link>
      <nav aria-label="メインナビゲーション">
        {[{ key: "home", href: "/", label: "ダッシュボード", icon: LayoutDashboard }, { key: "projects", href: "/projects", label: "プロジェクト", icon: FolderOpen }, { key: "series", href: "/series", label: "実験シリーズ", icon: FlaskConical }].map(({ key, href, label, icon: Icon }) => <Link key={key} href={href} className={`nav-item ${section === key ? "nav-item-active" : ""}`} aria-current={section === key ? "page" : undefined}><Icon size={18} aria-hidden="true" />{label}</Link>)}
        {[{ key: "protocols", label: "プロトコル", icon: BookMarked }, { key: "samples", label: "試料台帳", icon: TestTubes }, { key: "memos", label: "研究メモ", icon: FileText }].map(({ key, label, icon: Icon }) => <Link key={key} href={`/${key}`} className={`nav-item ${section === key ? "nav-item-active" : ""}`} aria-current={section === key ? "page" : undefined}><Icon size={18} aria-hidden="true" />{label}</Link>)}
      </nav>
      <Link href="/search" className={`nav-item ${section === "search" ? "nav-item-active" : ""}`}><FileText size={18} aria-hidden="true" />検索</Link>
      <Link href="/archive" className={`nav-item ${section === "archive" ? "nav-item-active" : ""}`}><FolderOpen size={18} aria-hidden="true" />アーカイブ</Link>
      <p className="sidebar-note">ひとつずつ、研究の足跡を。</p>
    </aside>
    <div className="main-shell">
      <header className="topbar"><nav aria-label="パンくず"><ol><li><Link href="/">ホーム</Link></li>{crumbs.map((c, i) => <li key={i}>{c.href ? <Link href={c.href}>{c.title}</Link> : <span aria-current="page">{c.title}</span>}</li>)}</ol></nav><span className="local-badge"><Monitor size={14} aria-hidden="true" />ローカル</span></header>
      <div className="content-layout"><main id="main-content">{children}</main><aside className="info-panel" aria-label="記録の情報">{info ?? <><h2>研究のワークスペース</h2><p>プロジェクトに実験シリーズをまとめ、日々の記録を積み重ねましょう。</p><div className="info-divider" /><h3>記録の流れ</h3><p>プロジェクト<br />↓<br />実験シリーズ<br />↓<br />日次記録</p></>}</aside></div>
    </div>
  </div>;
}

export function RecordList({ records, empty, allRecords = [] }: { records: ResearchRecord[]; empty: string; allRecords?: ResearchRecord[] }) {
  if (!records.length) return <div className="empty-state"><FileText size={27} aria-hidden="true" /><p>{empty}</p></div>;
  return <ul className="record-list">{records.map(r => {
    const parent = allRecords.find(p => p.id === r.parentId);
    return <li key={r.id}><Link href={recordPath(r)}><span className="record-mark" aria-hidden="true">{r.kind === "entry" ? <FileText size={20} /> : r.kind === "series" ? <FlaskConical size={20} /> : <FolderOpen size={20} />}</span><span className="record-summary"><strong>{r.title}</strong><small>{[r.date, parent?.title].filter(Boolean).join(" · ") || "プロジェクト"}</small></span><span className={`status-badge status-${r.status}`}>{statusLabels[r.status]}</span><span aria-hidden="true">→</span></Link></li>;
  })}</ul>;
}
