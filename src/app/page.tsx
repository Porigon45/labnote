import {
  BookMarked, FileText, FlaskConical, FolderOpen,
  LayoutDashboard, Monitor, NotebookPen, Sprout, TestTubes,
} from "lucide-react";

const sections = [
  { label: "プロジェクト", icon: FolderOpen },
  { label: "実験シリーズ", icon: FlaskConical },
  { label: "プロトコル", icon: BookMarked },
  { label: "試料台帳", icon: TestTubes },
  { label: "研究メモ", icon: FileText },
];

export default function Home() {
  return (
    <div className="workspace">
      <a className="skip-link" href="#main-content">本文へ移動</a>
      <aside className="sidebar" aria-label="ワークスペース">
        <a className="brand" href="/" aria-label="labnote ホーム">
          <Sprout size={25} strokeWidth={1.65} aria-hidden="true" />
          <span>labnote.</span>
        </a>
        <nav aria-label="メインナビゲーション">
          <a className="nav-item nav-item-active" href="/" aria-current="page">
            <LayoutDashboard size={18} aria-hidden="true" />ホーム
          </a>
          {sections.map(({ label, icon: Icon }) => (
            <div className="nav-item nav-item-planned" key={label} aria-disabled="true">
              <Icon size={18} aria-hidden="true" /><span>{label}</span>
            </div>
          ))}
        </nav>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>ホーム</span>
          <span className="local-badge"><Monitor size={14} aria-hidden="true" />ローカル</span>
        </header>
        <main id="main-content">
          <h1>実験ノート</h1>
          <section className="notebook-empty" aria-label="ノートの状態">
            <NotebookPen size={32} strokeWidth={1.4} aria-hidden="true" />
            <p>ノート機能を準備中</p>
          </section>
        </main>
      </div>
    </div>
  );
}
