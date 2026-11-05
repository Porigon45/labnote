CREATE TABLE records (
 id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('theme','project','series','entry','protocol','sample','memo','page')),
 parent_id TEXT REFERENCES records(id), title TEXT NOT NULL CHECK(length(trim(title))>0),
 body TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(body) AND json_type(body)='array'),
 purpose TEXT NOT NULL DEFAULT '', hypothesis TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('planned','active','completed')),
 date TEXT, end_date TEXT, category TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
 archived_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 CHECK(parent_id IS NULL OR parent_id<>id), CHECK(end_date IS NULL OR (date IS NOT NULL AND end_date>=date))
);
--> statement-breakpoint
CREATE INDEX records_parent ON records(parent_id);
--> statement-breakpoint
CREATE INDEX records_kind_updated ON records(kind, updated_at);
--> statement-breakpoint
CREATE TRIGGER records_parent_insert BEFORE INSERT ON records BEGIN
 SELECT CASE WHEN NEW.kind='series' AND NOT EXISTS(SELECT 1 FROM records WHERE id=NEW.parent_id AND kind='project') THEN RAISE(ABORT,'series requires project') END;
 SELECT CASE WHEN NEW.kind='entry' AND NOT EXISTS(SELECT 1 FROM records WHERE id=NEW.parent_id AND kind='series') THEN RAISE(ABORT,'entry requires series') END;
 SELECT CASE WHEN NEW.kind='project' AND NEW.parent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM records WHERE id=NEW.parent_id AND kind='theme') THEN RAISE(ABORT,'project requires theme') END;
END;
--> statement-breakpoint
CREATE TRIGGER records_identity_immutable BEFORE UPDATE OF id,kind,parent_id ON records BEGIN SELECT RAISE(ABORT,'record identity and hierarchy are immutable'); END;
--> statement-breakpoint
CREATE TABLE samples (
 record_id TEXT PRIMARY KEY NOT NULL REFERENCES records(id), type TEXT NOT NULL CHECK(type IN ('strain','plasmid','primer','medium','other')),
 parent_sample_id TEXT REFERENCES samples(record_id), origin TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT '', CHECK(record_id<>parent_sample_id)
);
--> statement-breakpoint
CREATE TRIGGER samples_kind BEFORE INSERT ON samples WHEN NOT EXISTS(SELECT 1 FROM records WHERE id=NEW.record_id AND kind='sample') BEGIN SELECT RAISE(ABORT,'sample requires sample record'); END;
--> statement-breakpoint
CREATE TRIGGER samples_identity BEFORE UPDATE OF record_id ON samples BEGIN SELECT RAISE(ABORT,'sample identity is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER samples_cycle BEFORE UPDATE OF parent_sample_id ON samples BEGIN
 SELECT CASE WHEN EXISTS(WITH RECURSIVE ancestors(id) AS (SELECT NEW.parent_sample_id UNION SELECT s.parent_sample_id FROM samples s JOIN ancestors a ON s.record_id=a.id) SELECT 1 FROM ancestors WHERE id=NEW.record_id) THEN RAISE(ABORT,'sample ancestry cycle') END;
END;
--> statement-breakpoint
CREATE TABLE protocol_versions (
 id TEXT PRIMARY KEY NOT NULL, protocol_id TEXT NOT NULL REFERENCES records(id), version INTEGER NOT NULL CHECK(version>0),
 title TEXT NOT NULL, body TEXT NOT NULL CHECK(json_valid(body) AND json_type(body)='array'), created_at TEXT NOT NULL,
 UNIQUE(protocol_id,version)
);
--> statement-breakpoint
CREATE TRIGGER protocol_version_kind BEFORE INSERT ON protocol_versions WHEN NOT EXISTS(SELECT 1 FROM records WHERE id=NEW.protocol_id AND kind='protocol') BEGIN SELECT RAISE(ABORT,'version requires protocol'); END;
--> statement-breakpoint
CREATE TRIGGER protocol_version_update BEFORE UPDATE ON protocol_versions BEGIN SELECT RAISE(ABORT,'protocol versions are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER protocol_version_delete BEFORE DELETE ON protocol_versions BEGIN SELECT RAISE(ABORT,'protocol versions are immutable'); END;
--> statement-breakpoint
CREATE TABLE protocol_snapshots (
 id TEXT PRIMARY KEY NOT NULL, entry_id TEXT NOT NULL REFERENCES records(id), version_id TEXT NOT NULL REFERENCES protocol_versions(id),
 changes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, UNIQUE(entry_id,version_id)
);
--> statement-breakpoint
CREATE TRIGGER snapshot_kind BEFORE INSERT ON protocol_snapshots WHEN NOT EXISTS(SELECT 1 FROM records WHERE id=NEW.entry_id AND kind='entry') BEGIN SELECT RAISE(ABORT,'snapshot requires entry'); END;
--> statement-breakpoint
CREATE TRIGGER snapshot_identity BEFORE UPDATE OF entry_id,version_id ON protocol_snapshots BEGIN SELECT RAISE(ABORT,'snapshot reference is immutable'); END;
--> statement-breakpoint
CREATE TABLE measurements (
 id TEXT PRIMARY KEY NOT NULL, record_id TEXT NOT NULL REFERENCES records(id), data TEXT NOT NULL CHECK(json_valid(data)), created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE attachments (
 id TEXT PRIMARY KEY NOT NULL, record_id TEXT NOT NULL REFERENCES records(id), filename TEXT NOT NULL, storage_key TEXT NOT NULL UNIQUE,
 mime TEXT NOT NULL, bytes INTEGER NOT NULL CHECK(bytes>=0 AND bytes<=104857600), caption TEXT NOT NULL DEFAULT '', archived_at TEXT, created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE content_links (
 id TEXT PRIMARY KEY NOT NULL, source_id TEXT NOT NULL REFERENCES records(id), target_id TEXT NOT NULL REFERENCES records(id), created_at TEXT NOT NULL,
 UNIQUE(source_id,target_id), CHECK(source_id<>target_id)
);
--> statement-breakpoint
CREATE INDEX content_links_target ON content_links(target_id);
--> statement-breakpoint
CREATE TABLE tags (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL UNIQUE CHECK(length(trim(name))>0));
--> statement-breakpoint
CREATE TABLE record_tags (record_id TEXT NOT NULL REFERENCES records(id), tag_id TEXT NOT NULL REFERENCES tags(id), UNIQUE(record_id,tag_id));
