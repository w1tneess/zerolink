import { NextRequest, NextResponse } from "next/server";
import { domainToASCII } from "node:url";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { blockedDomains } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/auth";

function normalizeBlockedDomain(raw: string): string | null {
  let candidate = raw.trim().toLowerCase().replace(/^https?:\/\//, "");
  candidate = candidate.split("/")[0]?.split("?")[0]?.split("#")[0] ?? "";
  if (!candidate || /[\s@[\]]/.test(candidate)) return null;
  candidate = candidate.split(":")[0]?.replace(/\.+$/, "") ?? "";
  if (!candidate || !candidate.includes(".")) return null;
  const ascii = domainToASCII(candidate).toLowerCase();
  if (!ascii || ascii.length > 253) return null;
  const labels = ascii.split(".");
  if (
    labels.some(
      (label) =>
        label.length === 0 ||
        label.length > 63 ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
    )
  ) {
    return null;
  }
  return ascii;
}

const addDomainSchema = z.object({
  domain: z.string().min(3).max(253),
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
  const normalizedDomain = parsed.success
    ? normalizeBlockedDomain(parsed.data.domain)
    : null;
  if (!parsed.success || !normalizedDomain) {
    return NextResponse.json(
      { error: "Please provide a valid domain name (e.g. spam.example)." },
      { status: 400 }
    );
  }

  const db = getDb();
  const inserted = db
    .insert(blockedDomains)
    .values({
      domain: normalizedDomain,
      reason: parsed.data.reason?.trim() || null,
      createdAt: Date.now(),
    })
    .onConflictDoNothing()
    .returning()
    .get();

  return NextResponse.json(
    { domain: inserted ?? { domain: normalizedDomain } },
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
