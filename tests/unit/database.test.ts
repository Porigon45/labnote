import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { getStorageConfig, type StorageConfig } from "../../src/server/config";
import { openDatabase, type DatabaseConnection } from "../../src/server/db";
import { migrateDatabase } from "../../src/server/db/migrate";

const migrationDirectory = resolve(process.cwd(), "drizzle");
let root: string;
let config: StorageConfig;
let connection: DatabaseConnection | undefined;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "labnote-db-test-"));
  config = getStorageConfig({}, root);
});

afterEach(() => {
  if (connection?.sqlite.open) connection.close();
  connection = undefined;
  rmSync(root, { recursive: true, force: true });
});

describe("database foundation", () => {
  it("creates local storage and opens SQLite with foreign keys and WAL enabled", () => {
    connection = openDatabase(config);
    expect(existsSync(config.databasePath)).toBe(true);
    expect(existsSync(config.attachmentsDir)).toBe(true);
    expect(existsSync(config.backupDir)).toBe(true);
    expect(connection.sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(connection.sqlite.pragma("journal_mode", { simple: true })).toBe("wal");
    expect(connection.db.get(sql`select 1 as ready`)).toEqual({ ready: 1 });
  });

  it("applies migrations once across repeated runs", () => {
    migrateDatabase(config, migrationDirectory);
    migrateDatabase(config, migrationDirectory);
    connection = openDatabase(config);
    expect(connection.sqlite.prepare("select count(*) as count from __drizzle_migrations").get())
      .toEqual({ count: 3 });
    const tables = connection.sqlite.prepare(
      "select name from sqlite_master where type = 'table' and name not like 'sqlite_%'",
    ).all();
    expect(tables).toEqual(expect.arrayContaining([{ name: "__drizzle_migrations" }, { name: "records" }, { name: "protocol_versions" }]));
  });

  it("persists committed values across a close and reopen and enforces foreign keys", () => {
    connection = openDatabase(config);
    connection.sqlite.exec(`
      CREATE TABLE test_parent (id INTEGER PRIMARY KEY);
      CREATE TABLE test_child (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES test_parent(id));
      INSERT INTO test_parent VALUES (1);
      INSERT INTO test_child VALUES (1, 1);
    `);
    expect(() => connection!.sqlite.prepare("insert into test_child values (?, ?)").run(2, 999))
      .toThrow(/FOREIGN KEY/);
    connection.close();
    connection = openDatabase(config);
    expect(connection.sqlite.prepare("select parent_id from test_child where id = 1").get())
      .toEqual({ parent_id: 1 });
  });

  it("supports FTS5 for the later search milestone", () => {
    connection = openDatabase(config);
    connection.sqlite.exec("CREATE VIRTUAL TABLE test_search USING fts5(body)");
    connection.sqlite.prepare("insert into test_search(body) values (?)").run("実験ノート PCR sample");
    expect(connection.sqlite.prepare("select body from test_search where test_search match ?").get("PCR"))
      .toEqual({ body: "実験ノート PCR sample" });
  });
});
