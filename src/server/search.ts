import { openDatabase, type DatabaseConnection } from "./db";
import { createRepository } from "./db/repository";
export type SearchFilters = { q?: string; kind?: string; project?: string; series?: string; tag?: string; from?: string; to?: string; status?: string };
export function searchRecords(filters: SearchFilters, connection?: DatabaseConnection) {
  const own = !connection;
  const db = connection ?? openDatabase();
  try {
    const repo = createRepository(db);
    const visible = repo.list();
    const byId = new Map(visible.map(r => [r.id, r]));
    const terms = (filters.q ?? "").trim().slice(0, 300).split(/\s+/).filter(Boolean);
    const ftsTerms = terms.filter(t => [...t].length >= 3);
    const expression = ftsTerms.map(t => `"${t.replaceAll('"', '""')}"`).join(" AND ");
    const hits = (expression ? db.sqlite.prepare("SELECT id, content, snippet(research_fts,2,'[',']','…',24) AS snippet FROM research_fts WHERE research_fts MATCH ? ORDER BY rank").all(expression) : db.sqlite.prepare("SELECT id, content, substr(content,1,180) AS snippet FROM research_fts").all()) as { id: string; content: string; snippet: string }[];
    return hits.flatMap(hit => {
      const record = byId.get(hit.id);
      if (!record || terms.some(t => !hit.content.toLowerCase().includes(t.toLowerCase()))) return [];
      if (filters.kind && record.kind !== filters.kind || filters.status && record.status !== filters.status) return [];
      if (filters.from && (!record.date || record.date < filters.from) || filters.to && (!record.date || record.date > filters.to)) return [];
      const ancestors = [];
      let parent = byId.get(record.parentId ?? "");
      while (parent) { ancestors.unshift(parent); parent = byId.get(parent.parentId ?? ""); }
      const hierarchy = [...ancestors, record];
      if (filters.project && !hierarchy.some(r => r.id === filters.project) || filters.series && !hierarchy.some(r => r.id === filters.series)) return [];
      const names = (db.sqlite.prepare("SELECT t.name FROM tags t JOIN record_tags rt ON t.id=rt.tag_id WHERE rt.record_id=?").all(record.id) as { name: string }[]).map(t => t.name);
      if (filters.tag && !names.includes(filters.tag)) return [];
      let snippet = hit.snippet;
      if (!expression && terms.length) {
        const at = hit.content.toLowerCase().indexOf(terms[0].toLowerCase());
        snippet = `${at > 35 ? "…" : ""}${hit.content.slice(Math.max(0, at - 35), at + 130)}`;
      }
      return [{ record, ancestors, snippet, tags: names }];
    }).slice(0, 100);
  } finally { if (own) db.close(); }
}
