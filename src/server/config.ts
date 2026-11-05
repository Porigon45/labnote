import { isAbsolute, relative, resolve, sep } from "node:path";

export type StorageConfig = Readonly<{
  dataDir: string;
  attachmentsDir: string;
  backupDir: string;
  databasePath: string;
}>;

type StorageEnvironment = Readonly<Record<string, string | undefined>>;

function contains(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

function directory(value: string | undefined, fallback: string, cwd: string, name: string): string {
  if (value !== undefined && value.trim() === "") {
    throw new Error(`${name} に空のパスは指定できません。`);
  }
  return resolve(cwd, value ?? fallback);
}

/** Resolves configuration without creating directories or opening the database. */
export function getStorageConfig(
  env: StorageEnvironment = process.env,
  cwd = process.cwd(),
): StorageConfig {
  const dataDir = directory(env.LABNOTE_DATA_DIR, "data", cwd, "LABNOTE_DATA_DIR");
  const attachmentsDir = directory(
    env.LABNOTE_ATTACHMENTS_DIR,
    resolve(dataDir, "attachments"),
    cwd,
    "LABNOTE_ATTACHMENTS_DIR",
  );
  const backupDir = directory(env.LABNOTE_BACKUP_DIR, "backups", cwd, "LABNOTE_BACKUP_DIR");

  for (const storageDir of [dataDir, attachmentsDir, backupDir]) {
    for (const reserved of ["public", ".git", ".next", ".next-e2e", "src", "node_modules"]) {
      const reservedDir = resolve(cwd, reserved);
      if (contains(reservedDir, storageDir) || contains(storageDir, reservedDir)) {
        throw new Error(`保存先を公開・ソース・ビルド用ディレクトリと分離してください: ${storageDir}`);
      }
    }
  }

  if (contains(attachmentsDir, dataDir)) {
    throw new Error("添付ファイル保存先にはデータディレクトリと異なるサブディレクトリを指定してください。");
  }
  if (
    contains(dataDir, backupDir) ||
    contains(backupDir, dataDir) ||
    contains(attachmentsDir, backupDir) ||
    contains(backupDir, attachmentsDir)
  ) {
    throw new Error("バックアップ先をデータ・添付ファイル保存先と分離してください。");
  }

  return { dataDir, attachmentsDir, backupDir, databasePath: resolve(dataDir, "labnote.sqlite") };
}
