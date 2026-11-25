import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { links } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/auth";
import { parseLinksImport } from "@/lib/links/import-export";
import { resolveSafeRedirectCode } from "@/lib/links/service";

const importSchema = z.object({
  format: z.enum(["json", "csv"]),
  content: z.string().min(1).max(2_000_000),
});

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid import payload." },
      { status: 400 }
    );
  }

  const { rows, errors } = parseLinksImport(
    parsed.data.format,
    parsed.data.content,
    { requestHost: request.headers.get("host") }
  );

  if (rows.length === 0 && errors.length > 0) {
    return NextResponse.json(
      { error: errors[0], errors },
      { status: 400 }
    );
  }

  const db = getDb();
  const now = Date.now();
  let inserted = 0;
  let skipped = 0;

  db.transaction((tx) => {
    for (const row of rows) {
      const existing = tx
        .select({ id: links.id })
        .from(links)
        .where(eq(links.slug, row.slug))
        .get();
      if (existing) {
        skipped++;
        continue;
      }

      tx.insert(links)
        .values({
          slug: row.slug,
          destinationUrl: row.destinationUrl,
          ownerType: "admin",
          status: row.status,
          redirectCode: resolveSafeRedirectCode(
            row.redirectCode,
            row.expiresAt,
            row.maxClicks
          ),
          passwordHash: null,
          clicks: 0,
          maxClicks: row.maxClicks,
          expiresAt: row.expiresAt,
          note: row.note ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      inserted++;
    }
  });

  return NextResponse.json(
    { inserted, skipped, errors },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
