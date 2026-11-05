import { ConflictError } from "./db/repository";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) throw new HttpError(403, "同じアプリから操作してください。");
}
export function apiError(error: unknown) {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ConflictError) return Response.json({ error: error.message }, { status: 409 });
  console.error(error);
  return Response.json({ error: "処理に失敗しました。入力と保存先を確認して再試行してください。" }, { status: 500 });
}
