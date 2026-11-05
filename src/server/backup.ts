import { createHash, randomUUID } from "node:crypto";
import { createReadStream, existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { chmod, copyFile, mkdir, open, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import Database from "better-sqlite3";
import { getStorageConfig, type StorageConfig } from "./config";
import { openDatabase } from "./db";

type FileDigest = { path: string; bytes: number; sha256: string };
export type BackupManifest = { version: 1; createdAt: string; files: FileDigest[] };
export type BackupInfo = { directory: string; manifest: BackupManifest };
const dateKey = (time: string | Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date(time));
function weekKey(time: string) { const date = new Date(dateKey(time) + "T00:00:00Z"); date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7); return date.toISOString().slice(0, 10); }
function safePath(root: string, path: string) {
  if (!(path === "database.sqlite" || /^attachments\/[\w-]+$/.test(path))) throw new Error("バックアップ内のパスが不正です。");
  const result = resolve(root, path);
  if (relative(realpathSync(root), realpathSync(result)).startsWith("..") || lstatSync(result).isSymbolicLink()) throw new Error("バックアップ内のリンクは復元できません。");
  return result;
}
async function digest(path: string): Promise<Omit<FileDigest, "path">> {
  const hash = createHash("sha256"); let bytes = 0;
  for await (const chunk of createReadStream(path)) { hash.update(chunk); bytes += chunk.length; }
  return { sha256: hash.digest("hex"), bytes };
}
async function syncFile(path: string) { const file = await open(path, "r"); try { await file.sync(); } finally { await file.close(); } }
export function listBackups(config: StorageConfig = getStorageConfig()): BackupInfo[] {
  if (!existsSync(config.backupDir)) return [];
  return readdirSync(config.backupDir).filter(n => /^snapshot-[\dT-]+-[\w-]+$/.test(n)).flatMap(name => {
    const directory = join(config.backupDir, name);
    try {
      if (lstatSync(directory).isSymbolicLink()) return [];
      const manifest = JSON.parse(readFileSync(join(directory, "manifest.json"), "utf8")) as BackupManifest;
      if (manifest.version !== 1 || !Number.isFinite(Date.parse(manifest.createdAt)) || !Array.isArray(manifest.files)) return [];
      return [{ directory, manifest }];
    } catch { return []; }
  }).sort((a, b) => b.manifest.createdAt.localeCompare(a.manifest.createdAt));
}
export function retainedBackups(backups: BackupInfo[]) {
  const keep = new Set<string>();
  for (const [key, count] of [[(b: BackupInfo) => dateKey(b.manifest.createdAt), 7], [(b: BackupInfo) => weekKey(b.manifest.createdAt), 4]] as const) {
    const seen = new Set<string>();
    for (const b of [...backups].sort((a, b) => b.manifest.createdAt.localeCompare(a.manifest.createdAt))) {
      if (!seen.has(key(b)) && seen.size < count) { seen.add(key(b)); keep.add(b.directory); }
    }
  }
  return keep;
}
async function prune(config: StorageConfig) {
  const backups = listBackups(config); const keep = retainedBackups(backups);
  const root = realpathSync(config.backupDir);
  for (const b of backups) if (!keep.has(b.directory) && dirname(realpathSync(b.directory)) === root) await rm(b.directory, { recursive: true });
}
function integrity(sqlite: Database.Database) {
  if (sqlite.pragma("integrity_check", { simple: true }) !== "ok" || (sqlite.pragma("foreign_key_check") as unknown[]).length) throw new Error("SQLite整合性検査に失敗しました。");
}
export async function createBackup(config: StorageConfig = getStorageConfig(), time = new Date()): Promise<string> {
  const connection = openDatabase(config);
  const lockPath = join(config.backupDir, ".backup.lock");
  let lock;
  try {
    try { lock = await open(lockPath, "wx", 0o600); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const pid = Number(readFileSync(lockPath, "utf8"));
      let alive = true;
      if (!Number.isSafeInteger(pid) || pid < 1) throw new Error("バックアップのロックを確認してください。");
      try { process.kill(pid, 0); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ESRCH") alive = false; }
      if (alive) throw new Error("バックアップを実行中です。");
      await rm(lockPath); lock = await open(lockPath, "wx", 0o600);
    }
    await lock.writeFile(String(process.pid));
    const name = `snapshot-${time.toISOString().replaceAll(/[:.Z]/g, "-")}-${randomUUID()}`;
    const partial = join(config.backupDir, ".partial-" + randomUUID());
    const destination = join(config.backupDir, name);
    await mkdir(join(partial, "attachments"), { recursive: true, mode: 0o700 });
    try {
      const databasePath = join(partial, "database.sqlite");
      await connection.sqlite.backup(databasePath);
      await chmod(databasePath, 0o600);
      const snapshot = new Database(databasePath, { readonly: true, fileMustExist: true });
      let rows: { storage_key: string; bytes: number }[];
      try { integrity(snapshot); rows = snapshot.prepare("SELECT storage_key,bytes FROM attachments").all() as typeof rows; } finally { snapshot.close(); }
      const files: FileDigest[] = [{ path: "database.sqlite", ...await digest(databasePath) }];
      for (const row of rows) {
        if (!/^[\w-]+$/.test(row.storage_key)) throw new Error("添付の保存キーが不正です。");
        const source = join(config.attachmentsDir, row.storage_key);
        if (lstatSync(source).isSymbolicLink() || statSync(source).size !== row.bytes) throw new Error("添付が欠損または破損しています。");
        const path = `attachments/${row.storage_key}`;
        await copyFile(source, join(partial, path)); await chmod(join(partial, path), 0o600);
        files.push({ path, ...await digest(join(partial, path)) });
      }
      const manifest: BackupManifest = { version: 1, createdAt: time.toISOString(), files };
      await writeFile(join(partial, "manifest.json"), JSON.stringify(manifest, null, 2), { mode: 0o600 });
      for (const file of files) await syncFile(join(partial, file.path));
      await syncFile(join(partial, "manifest.json"));
      await syncFile(join(partial, "attachments"));
      await syncFile(partial);
      await rename(partial, destination);
      await syncFile(config.backupDir);
      await prune(config);
      return destination;
    } catch (error) { await rm(partial, { recursive: true, force: true }); throw error; }
  } finally {
    connection.close();
    if (lock) { await lock.close(); await rm(lockPath, { force: true }); }
  }
}
export async function ensureDailyBackup(config: StorageConfig = getStorageConfig()) {
  if (listBackups(config).some(b => dateKey(b.manifest.createdAt) === dateKey(new Date()))) return null;
  return createBackup(config);
}
export async function restoreBackup(directory: string, target: string) {
  const source = realpathSync(directory);
  const root = resolve(target);
  if (existsSync(root) && (lstatSync(root).isSymbolicLink() || readdirSync(root).length)) throw new Error("復元先には新しい空のディレクトリを指定してください。");
  if (source === root || source.startsWith(root + "/")) throw new Error("バックアップとは別の復元先を指定してください。");
  const manifest = JSON.parse(readFileSync(join(source, "manifest.json"), "utf8")) as BackupManifest;
  if (manifest.version !== 1 || !Array.isArray(manifest.files) || manifest.files.filter(f => f.path === "database.sqlite").length !== 1 || new Set(manifest.files.map(f => f.path)).size !== manifest.files.length) throw new Error("バックアップ形式が不正です。");
  for (const item of manifest.files) { const actual = await digest(safePath(source, item.path)); if (actual.sha256 !== item.sha256 || actual.bytes !== item.bytes) throw new Error(`バックアップの検証に失敗しました: ${item.path}`); }
  const snapshot = new Database(safePath(source, "database.sqlite"), { readonly: true, fileMustExist: true });
  try {
    integrity(snapshot);
    const required = snapshot.prepare("SELECT storage_key,bytes FROM attachments").all() as { storage_key: string; bytes: number }[];
    for (const row of required) if (!manifest.files.some(f => f.path === `attachments/${row.storage_key}` && f.bytes === row.bytes)) throw new Error("バックアップに必要な添付がありません。");
  } finally { snapshot.close(); }
  const config = getStorageConfig({}, root);
  await mkdir(config.attachmentsDir, { recursive: true, mode: 0o700 });
  for (const item of manifest.files) {
    const destination = item.path === "database.sqlite" ? config.databasePath : join(config.attachmentsDir, item.path.slice("attachments/".length));
    await copyFile(safePath(source, item.path), destination); await chmod(destination, 0o600);
  }
  const connection = openDatabase(config);
  try { integrity(connection.sqlite); } finally { connection.close(); }
  return config;
}
