import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { blockedDomains } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/auth";

const addDomainSchema = z.object({
  domain: z
    .string()
    .min(3)
    .max(253)
    .transform((v) =>
      v
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .split("/")[0]
        .split(":")[0]
        .replace(/\.+$/, "")
    ),
  reason: z.string().max(250).optional().nullable(),
});

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getDb();
  const rows = db
    .select()
    .from(blockedDomains)
    .orderBy(desc(blockedDomains.createdAt))
    .all();
  return NextResponse.json(
    { domains: rows },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}

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

  const parsed = addDomainSchema.safeParse(body);
  if (!parsed.success || !parsed.data.domain.includes(".")) {
    return NextResponse.json(
      { error: "Please provide a valid domain name (e.g. spam.example)." },
      { status: 400 }
    );
  }

  const db = getDb();
  const inserted = db
    .insert(blockedDomains)
    .values({
      domain: parsed.data.domain,
      reason: parsed.data.reason?.trim() || null,
      createdAt: Date.now(),
    })
    .onConflictDoNothing()
    .returning()
    .get();

  return NextResponse.json(
    { domain: inserted ?? { domain: parsed.data.domain } },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdminAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idParam = request.nextUrl.searchParams.get("id");
  const id = Number.parseInt(idParam ?? "", 10);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid blocklist ID." }, { status: 400 });
  }

  const db = getDb();
  db.delete(blockedDomains).where(eq(blockedDomains.id, id)).run();

  return NextResponse.json(
    { ok: true },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
