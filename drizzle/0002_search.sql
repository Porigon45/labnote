CREATE TABLE body_links (source_id TEXT NOT NULL REFERENCES records(id), target_id TEXT NOT NULL REFERENCES records(id), PRIMARY KEY(source_id,target_id), CHECK(source_id<>target_id));
--> statement-breakpoint
INSERT OR IGNORE INTO body_links(source_id,target_id) SELECT r.id,t.id FROM records r, json_tree(r.body) j JOIN records t ON j.atom IN ('/entries/'||t.id,'/projects/'||t.id,'/series/'||t.id,'/protocols/'||t.id,'/samples/'||t.id,'/memos/'||t.id) WHERE j.key IN ('url','href') AND r.id<>t.id;
--> statement-breakpoint
CREATE VIEW search_documents AS SELECT r.id, r.title, r.title || ' ' || r.purpose || ' ' || r.hypothesis || ' ' || r.category || ' ' ||
COALESCE((SELECT group_concat(j.atom,' ') FROM json_tree(r.body) j WHERE j.type='text' AND j.key IN ('text','content','formula','caption','label','data')), '') || ' ' ||
COALESCE((SELECT group_concat(t.name,' ') FROM record_tags rt JOIN tags t ON rt.tag_id=t.id WHERE rt.record_id=r.id),'') || ' ' ||
COALESCE((SELECT group_concat(a.caption || ' ' || a.filename,' ') FROM attachments a WHERE a.record_id=r.id AND a.archived_at IS NULL),'') || ' ' ||
COALESCE((SELECT group_concat(target.title,' ') FROM records target WHERE target.id IN (SELECT target_id FROM content_links WHERE source_id=r.id UNION SELECT target_id FROM body_links WHERE source_id=r.id)),'') || ' ' ||
COALESCE((SELECT group_concat(v.title || ' ' || s.changes,' ') FROM protocol_snapshots s JOIN protocol_versions v ON s.version_id=v.id WHERE s.entry_id=r.id),'') AS content FROM records r;
--> statement-breakpoint
CREATE VIRTUAL TABLE research_fts USING fts5(id UNINDEXED, title, content, tokenize='trigram');
--> statement-breakpoint
INSERT INTO research_fts(id,title,content) SELECT id,title,content FROM search_documents;
--> statement-breakpoint
CREATE TRIGGER search_record_insert AFTER INSERT ON records BEGIN DELETE FROM research_fts WHERE id=NEW.id; INSERT INTO research_fts(id,title,content) SELECT id,title,content FROM search_documents WHERE id=NEW.id; END;
--> statement-breakpoint
CREATE TRIGGER search_record_update AFTER UPDATE ON records BEGIN DELETE FROM research_fts WHERE id=NEW.id OR id IN (SELECT source_id FROM content_links WHERE target_id=NEW.id UNION SELECT source_id FROM body_links WHERE target_id=NEW.id); INSERT INTO research_fts(id,title,content) SELECT id,title,content FROM search_documents WHERE id=NEW.id OR id IN (SELECT source_id FROM content_links WHERE target_id=NEW.id UNION SELECT source_id FROM body_links WHERE target_id=NEW.id); END;
--> statement-breakpoint
CREATE TRIGGER search_record_tags_insert AFTER INSERT ON record_tags BEGIN DELETE FROM research_fts WHERE id=NEW.record_id; INSERT INTO research_fts(id,title,content) SELECT id,title,content FROM search_documents WHERE id=NEW.record_id; END;
--> statement-breakpoint
CREATE TRIGGER search_record_tags_delete AFTER DELETE ON record_tags BEGIN DELETE FROM research_fts WHERE id=OLD.record_id; INSERT INTO research_fts(id,title,content) SELECT id,title,content FROM search_documents WHERE id=OLD.record_id; END;
--> statement-breakpoint
CREATE TRIGGER search_attachments_insert AFTER INSERT ON attachments BEGIN DELETE FROM research_fts WHERE id=NEW.record_id; INSERT INTO research_fts(id,title,content) SELECT id,title,content FROM search_documents WHERE id=NEW.record_id; END;
--> statement-breakpoint
CREATE TRIGGER search_attachments_delete AFTER DELETE ON attachments BEGIN DELETE FROM research_fts WHERE id=OLD.record_id; INSERT INTO research_fts(id,title,content) SELECT id,title,content FROM search_documents WHERE id=OLD.record_id; END;
--> statement-breakpoint
CREATE TRIGGER search_attachment_update AFTER UPDATE ON attachments BEGIN DELETE FROM research_fts WHERE id=NEW.record_id; INSERT INTO research_fts(id,title,content) SELECT id,title,content FROM search_documents WHERE id=NEW.record_id; END;
--> statement-breakpoint
CREATE TRIGGER search_content_links_insert AFTER INSERT ON content_links BEGIN DELETE FROM research_fts WHERE id=NEW.source_id; INSERT INTO research_fts(id,title,content) SELECT id,title,content FROM search_documents WHERE id=NEW.source_id; END;
--> statement-breakpoint
CREATE TRIGGER search_content_links_delete AFTER DELETE ON content_links BEGIN DELETE FROM research_fts WHERE id=OLD.source_id; INSERT INTO research_fts(id,title,content) SELECT id,title,content FROM search_documents WHERE id=OLD.source_id; END;
--> statement-breakpoint
CREATE TRIGGER search_body_links_insert AFTER INSERT ON body_links BEGIN DELETE FROM research_fts WHERE id=NEW.source_id; INSERT INTO research_fts(id,title,content) SELECT id,title,content FROM search_documents WHERE id=NEW.source_id; END;
--> statement-breakpoint
CREATE TRIGGER search_body_links_delete AFTER DELETE ON body_links BEGIN DELETE FROM research_fts WHERE id=OLD.source_id; INSERT INTO research_fts(id,title,content) SELECT id,title,content FROM search_documents WHERE id=OLD.source_id; END;
--> statement-breakpoint
CREATE TRIGGER search_protocol_snapshots_insert AFTER INSERT ON protocol_snapshots BEGIN DELETE FROM research_fts WHERE id=NEW.entry_id; INSERT INTO research_fts(id,title,content) SELECT id,title,content FROM search_documents WHERE id=NEW.entry_id; END;
--> statement-breakpoint
CREATE TRIGGER search_protocol_snapshots_delete AFTER DELETE ON protocol_snapshots BEGIN DELETE FROM research_fts WHERE id=OLD.entry_id; INSERT INTO research_fts(id,title,content) SELECT id,title,content FROM search_documents WHERE id=OLD.entry_id; END;
--> statement-breakpoint
CREATE TRIGGER search_tag_update AFTER UPDATE ON tags BEGIN DELETE FROM research_fts WHERE id IN (SELECT record_id FROM record_tags WHERE tag_id=NEW.id); INSERT INTO research_fts(id,title,content) SELECT id,title,content FROM search_documents WHERE id IN (SELECT record_id FROM record_tags WHERE tag_id=NEW.id); END;
