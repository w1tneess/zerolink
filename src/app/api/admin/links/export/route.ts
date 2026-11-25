import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { links } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  exportLinksToCsv,
  exportLinksToJson,
} from "@/lib/links/import-export";

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const format =
    request.nextUrl.searchParams.get("format") === "csv" ? "csv" : "json";

  const db = getDb();
  const records = db
    .select()
    .from(links)
    .where(eq(links.ownerType, "admin"))
    .orderBy(desc(links.createdAt))
    .all();

  if (format === "csv") {
    const csv = exportLinksToCsv(records);
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="personal-links.csv"',
        "Content-Security-Policy": "sandbox",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      },
    });
  }

  const json = exportLinksToJson(records);
  return new Response(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="personal-links.json"',
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
