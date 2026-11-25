import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { settings } from "@/db/schema";

export async function GET() {
  try {
    const db = await getDb();
    await db.select({ key: settings.key }).from(settings).limit(1);
    return NextResponse.json(
      { ok: true, status: "healthy", timestamp: Date.now() },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { ok: false, status: "unhealthy" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
