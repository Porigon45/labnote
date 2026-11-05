import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { getStorageConfig } from "../../src/server/config";
import { migrateDatabase } from "../../src/server/db/migrate";
import { openDatabase } from "../../src/server/db";
import { createRepository } from "../../src/server/db/repository";
import { attachmentType, auditAttachments, checkQuota, FILE_LIMIT, TOTAL_LIMIT, saveAttachment } from "../../src/server/attachments";

it("rejects per-file and total quota overflows and unsupported or unsafe filenames", () => {
  expect(() => checkQuota(FILE_LIMIT + 1, 0)).toThrow("100MB");
  expect(() => checkQuota(1, TOTAL_LIMIT)).toThrow("10GB");
  expect(() => attachmentType("../a.png")).toThrow();
  expect(() => attachmentType("run.exe")).toThrow("未対応");
  expect(attachmentType("写真.PNG")).toBe("image/png");
});

it("persists uploads, cleans rejected uploads, and detects missing, wrong-size and orphan files", async () => {
  const root = mkdtempSync(join(tmpdir(), "labnote-upload-"));
  const config = getStorageConfig({}, root);
  try {
    migrateDatabase(config);
    const connection = openDatabase(config);
    const repo = createRepository(connection);
    const record = repo.create({ kind: "memo", title: "添付" });
    connection.close();
    const a = await saveAttachment(record.id, "test.txt", new Blob(["test"]).stream(), config);
    expect(a.bytes).toBe(4);
    expect(auditAttachments(config)).toEqual({ bytes: 4, missing: [], mismatched: [], orphaned: [] });
    await expect(saveAttachment(record.id, "fake.png", new Blob(["not png"]).stream(), config)).rejects.toThrow("一致");
    expect(auditAttachments(config).orphaned).toEqual([]);
    writeFileSync(join(config.attachmentsDir, a.storageKey), "different");
    expect(auditAttachments(config).mismatched).toEqual([a.id]);
    rmSync(join(config.attachmentsDir, a.storageKey));
    writeFileSync(join(config.attachmentsDir, "orphan"), "orphan");
    expect(auditAttachments(config).missing).toEqual([a.id]);
    expect(auditAttachments(config).orphaned).toEqual(["orphan"]);
  } finally { rmSync(root, { force: true, recursive: true }); }
});
