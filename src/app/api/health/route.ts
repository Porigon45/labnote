import { openDatabase } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const connection = openDatabase();
    try {
      connection.sqlite.prepare("SELECT 1").get();
      return Response.json({ status: "ok", database: "ok" }, {
        headers: { "Cache-Control": "no-store" },
      });
    } finally {
      connection.close();
    }
  } catch (error) {
    console.error("Database health check failed", error);
    return Response.json({ status: "error", database: "unavailable" }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
