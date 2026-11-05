import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { getStorageConfig } from "../../src/server/config";
import { migrateDatabase } from "../../src/server/db/migrate";
import { openDatabase } from "../../src/server/db";
import { createRepository } from "../../src/server/db/repository";
import { seedResearchFixture } from "../../src/server/db/seed";
import { saveAttachment, auditAttachments } from "../../src/server/attachments";
import { createBackup, ensureDailyBackup, listBackups, restoreBackup, retainedBackups, type BackupInfo } from "../../src/server/backup";

it("backs up a consistent database with attachments, restores to empty storage and rejects corruption or overwrite", async () => {
  const root = mkdtempSync(join(tmpdir(), "labnote-backup-"));
  try {
    const config = getStorageConfig({}, join(root, "source")); migrateDatabase(config);
    const connection = openDatabase(config); const repo = createRepository(connection);
    const f = seedResearchFixture(repo); const expected = repo.detail(f.entry.id); connection.close();
    const attachment = await saveAttachment(f.entry.id, "notes.txt", new Blob(["議論と次の操作"]).stream(), config);
    const backup = await createBackup(config);
    expect(listBackups(config)).toHaveLength(1);
    expect(await ensureDailyBackup(config)).toBeNull();
    const restored = await restoreBackup(backup, join(root, "restored"));
    const restoredConnection = openDatabase(restored);
    try {
      const actual = createRepository(restoredConnection).detail(f.entry.id);
      expect({ ...actual, attachments: [] }).toEqual(expected);
      expect(actual.attachments[0].id).toBe(attachment.id);
      expect(readFileSync(join(restored.attachmentsDir, attachment.storageKey), "utf8")).toBe("議論と次の操作");
    } finally { restoredConnection.close(); }
    expect(auditAttachments(restored).missing).toEqual([]);
    await expect(restoreBackup(backup, join(root, "restored"))).rejects.toThrow("空");
    writeFileSync(join(backup, "attachments", attachment.storageKey), "corrupt");
    await expect(restoreBackup(backup, join(root, "bad"))).rejects.toThrow("検証");
    expect(existsSync(join(root, "bad"))).toBe(false);
    rmSync(join(config.attachmentsDir, attachment.storageKey));
    await expect(createBackup(config)).rejects.toThrow();
    expect(existsSync(join(config.backupDir, ".backup.lock"))).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it("retains the newest seven daily and four weekly generations without duplicate snapshots", () => {
  const backups: BackupInfo[] = Array.from({ length: 45 }, (_, day) => ({ directory: `backup-${day}`, manifest: { version: 1, createdAt: new Date(Date.UTC(2026, 8, 1 + day)).toISOString(), files: [] } }));
  backups.push({ directory: "duplicate-old", manifest: { ...backups[44].manifest, createdAt: "2026-10-15T00:00:00.000Z" } });
  const keep = retainedBackups(backups);
  for (let day = 38; day <= 44; day++) expect(keep.has(`backup-${day}`)).toBe(true);
  expect(keep.size).toBeLessThanOrEqual(11);
  expect(keep.has("backup-0")).toBe(false);
});
