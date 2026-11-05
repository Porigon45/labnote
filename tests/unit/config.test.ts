import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getStorageConfig } from "../../src/server/config";

const root = resolve("/tmp/labnote-config-test");

describe("storage configuration", () => {
  it("keeps the database, attachments and backups separate by default", () => {
    expect(getStorageConfig({}, root)).toEqual({
      dataDir: resolve(root, "data"),
      attachmentsDir: resolve(root, "data/attachments"),
      backupDir: resolve(root, "backups"),
      databasePath: resolve(root, "data/labnote.sqlite"),
    });
  });

  it("resolves overrides relative to the application and follows the data directory default", () => {
    const config = getStorageConfig({ LABNOTE_DATA_DIR: "runtime/db" }, root);
    expect(config.attachmentsDir).toBe(resolve(root, "runtime/db/attachments"));
    expect(config.databasePath).toBe(resolve(root, "runtime/db/labnote.sqlite"));
    expect(getStorageConfig({ LABNOTE_BACKUP_DIR: "/tmp/labnote-backups" }, root).backupDir)
      .toBe("/tmp/labnote-backups");
  });

  it.each(["public", "public/private", "./data/../public", ".", ".git/data", ".next/data", "src/data"])(
    "rejects public or application storage path %s",
    (path) => {
      expect(() => getStorageConfig({ LABNOTE_DATA_DIR: path }, root)).toThrow();
      expect(() => getStorageConfig({ LABNOTE_ATTACHMENTS_DIR: path }, root)).toThrow();
      expect(() => getStorageConfig({ LABNOTE_BACKUP_DIR: path }, root)).toThrow();
    },
  );

  it("rejects empty paths and backup paths overlapping data or attachments", () => {
    expect(() => getStorageConfig({ LABNOTE_DATA_DIR: " " }, root)).toThrow();
    expect(() => getStorageConfig({ LABNOTE_BACKUP_DIR: "data/backups" }, root)).toThrow();
    expect(() => getStorageConfig({ LABNOTE_ATTACHMENTS_DIR: "data" }, root)).toThrow();
    expect(() => getStorageConfig({
      LABNOTE_ATTACHMENTS_DIR: "files",
      LABNOTE_BACKUP_DIR: "files/backups",
    }, root)).toThrow();
  });
});
