import { withResearch } from "@/server/research";
import { apiError, checkOrigin, HttpError } from "@/server/http";
import type { Block } from "@/server/db/schema";
import { blockTypes } from "@/lib/blocks";
import { validMeasurement } from "@/lib/measurement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const record = withResearch(repo => repo.list().find(r => r.id === id));
    if (!record) throw new HttpError(404, "記録が見つかりません。");
    return Response.json(record, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
export async function PATCH(request: Request, context: Context) {
  try {
    checkOrigin(request);
    if (!request.headers.get("content-type")?.includes("application/json")) throw new HttpError(415, "JSONを指定してください。");
    const text = await request.text();
    if (text.length > 2_000_000) throw new HttpError(413, "本文が大きすぎます。");
    let input;
    try { input = JSON.parse(text); } catch { throw new HttpError(400, "JSONが不正です。"); }
    if (!input || !Number.isSafeInteger(input.revision) || input.revision < 1 || !Array.isArray(input.body)) throw new HttpError(400, "本文と更新番号を指定してください。");
    const ids = new Set<string>();
    const valid = (blocks: Block[], depth = 0): boolean => depth < 30 && blocks.every(b => {
      if (!b || typeof b.id !== "string" || !b.id || ids.has(b.id) || !blockTypes.has(b.type)) return false;
      if (b.type === "measurement") { try { if (!validMeasurement(JSON.parse((b.props as { data: string }).data))) return false; } catch { return false; } }
      ids.add(b.id);
      return b.children === undefined || (Array.isArray(b.children) && valid(b.children as Block[], depth + 1));
    });
    if (!valid(input.body)) throw new HttpError(400, "本文ブロックが不正です。");
    const { id } = await context.params;
    const updated = withResearch(repo => {
      const record = repo.list().find(r => r.id === id);
      if (!record || !["entry", "protocol", "memo"].includes(record.kind)) throw new HttpError(404, "編集対象が見つかりません。");
      return repo.update(id, input.revision, { body: input.body });
    });
    return Response.json({ revision: updated.revision });
  } catch (error) { return apiError(error); }
}
