import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, statSync } from "node:fs";
import { open, rename, rm } from "node:fs/promises";
import { extname, join } from "node:path";
import { getStorageConfig, type StorageConfig } from "./config";
import { openDatabase } from "./db";
import { createRepository } from "./db/repository";
import { attachments } from "./db/schema";
import { HttpError } from "./http";

export const FILE_LIMIT = 100 * 1024 ** 2;
export const TOTAL_LIMIT = 10 * 1024 ** 3;
const types: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".pdf": "application/pdf", ".txt": "text/plain", ".csv": "text/csv", ".tsv": "text/tab-separated-values", ".json": "application/json", ".zip": "application/zip", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
export function attachmentType(filename: string) {
  if (!filename || filename.length > 240 || /[\x00-\x1f\\/]/.test(filename)) throw new HttpError(400, "ファイル名が不正です。");
  const mime = types[extname(filename).toLowerCase()];
  if (!mime) throw new HttpError(415, "未対応のファイルです。画像、PDF、テキスト、CSV、Office、ZIPを利用してください。");
  return mime;
}
export function checkQuota(bytes: number, used: number) {
  if (bytes > FILE_LIMIT) throw new HttpError(413, "1ファイル100MBを超えています。");
  if (bytes + used > TOTAL_LIMIT) throw new HttpError(413, "添付の合計10GBを超えています。");
}
function checkSignature(mime: string, head: Buffer) {
  const hex = head.toString("hex");
  const ok = mime === "image/png" ? hex.startsWith("89504e470d0a1a0a") : mime === "image/jpeg" ? hex.startsWith("ffd8ff") : mime === "image/gif" ? head.toString().startsWith("GIF8") : mime === "image/webp" ? head.toString().startsWith("RIFF") && head.subarray(8, 12).toString() === "WEBP" : mime === "application/pdf" ? head.toString().startsWith("%PDF-") : mime === "application/zip" || mime.includes("officedocument") ? hex.startsWith("504b") : !head.includes(0);
  if (!ok) throw new HttpError(415, "拡張子とファイル内容が一致しません。");
}
export async function saveAttachment(recordId: string, filename: string, body: ReadableStream<Uint8Array>, config: StorageConfig = getStorageConfig()) {
  const mime = attachmentType(filename);
  const connection = openDatabase(config);
  const repo = createRepository(connection);
  const storageKey = randomUUID();
  const temporary = join(config.attachmentsDir, storageKey + ".part");
  const destination = join(config.attachmentsDir, storageKey);
  let committed = false;
  try {
    if (!repo.list().some(r => r.id === recordId)) throw new HttpError(404, "記録が見つかりません。");
    const file = await open(temporary, "wx", 0o600);
    let size = 0;
    let head = Buffer.alloc(0);
    try {
      for await (const chunk of body) {
        size += chunk.byteLength; checkQuota(size, 0);
        if (head.length < 32) head = Buffer.concat([head, Buffer.from(chunk)]).subarray(0, 32);
        await file.writeFile(chunk);
      }
      await file.sync();
    } finally { await file.close(); }
    checkSignature(mime, head);
    await rename(temporary, destination);
    const result = connection.db.transaction(() => {
      if (!repo.list().some(r => r.id === recordId)) throw new HttpError(404, "記録が見つかりません。");
      const used = connection.sqlite.prepare("SELECT COALESCE(SUM(bytes),0) AS bytes FROM attachments").get() as { bytes: number };
      checkQuota(size, used.bytes);
      return repo.addAttachment({ recordId, filename, storageKey, mime, bytes: size });
    }, { behavior: "immediate" });
    committed = true;
    return result;
  } finally {
    connection.close();
    await rm(temporary, { force: true });
    if (!committed) await rm(destination, { force: true });
  }
}
export function auditAttachments(config: StorageConfig = getStorageConfig()) {
  const connection = openDatabase(config);
  try {
    const rows = connection.db.select().from(attachments).all();
    const keys = new Set(rows.map(r => r.storageKey));
    const missing = rows.filter(r => !existsSync(join(config.attachmentsDir, r.storageKey))).map(r => r.id);
    const mismatched = rows.filter(r => existsSync(join(config.attachmentsDir, r.storageKey)) && statSync(join(config.attachmentsDir, r.storageKey)).size !== r.bytes).map(r => r.id);
    const orphaned = readdirSync(config.attachmentsDir).filter(name => !keys.has(name));
    return { missing, mismatched, orphaned, bytes: rows.reduce((sum, r) => sum + r.bytes, 0) };
  } finally { connection.close(); }
}
