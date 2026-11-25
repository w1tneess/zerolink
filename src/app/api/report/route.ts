import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { abuseReports, links } from "@/db/schema";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";
import { verifyPowSolution } from "@/lib/pow";
import { getLinkBySlug } from "@/lib/links/service";

const reportSchema = z.object({
  slugOrUrl: z.string().min(1).max(512),
  reason: z.enum(["phishing", "malware", "spam", "illegal", "other"]),
  details: z.string().max(500).optional().nullable(),
  website: z.string().optional().default(""), // honeypot
  pow: z.object({
    challengeId: z.string(),
    prefix: z.string(),
    difficulty: z.number().int(),
    expiresAt: z.number(),
    sig: z.string(),
    nonce: z.string(),
  }),
});

function extractSlug(input: string): string {
  const trimmed = input.trim();
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const u = new URL(trimmed);
      const seg = u.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
      return seg.replace(/\+$/, "");
    }
  } catch {
    // fall through to path parsing
  }
  return trimmed.replace(/^\/+/, "").split("?")[0].replace(/\+$/, "");
}

export async function POST(request: NextRequest) {
  const ip = extractClientIp(request);
  const rate = checkRateLimit("public_report", ip, 10, 15 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit exceeded. Please retry in ${rate.retryAfterSeconds}s.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please provide a valid link slug and abuse category." },
      { status: 400 }
    );
  }

  const data = parsed.data;

  if (data.website && data.website.trim().length > 0) {
    return NextResponse.json(
      { error: "Request rejected by spam protection." },
      { status: 400 }
    );
  }

  const powCheck = verifyPowSolution(data.pow);
  if (!powCheck.valid) {
    return NextResponse.json(
      { error: powCheck.reason ?? "Proof-of-Work verification failed." },
      { status: 403 }
    );
  }

  const slug = extractSlug(data.slugOrUrl);
  if (!slug) {
    return NextResponse.json(
      { error: "Could not determine a valid short link slug." },
      { status: 400 }
    );
  }

  const targetLink = getLinkBySlug(slug);
  if (!targetLink) {
    return NextResponse.json(
      { error: `No short link found for "/${slug}".` },
      { status: 404 }
    );
  }

  const db = getDb();
  const now = Date.now();

  // Store report with ZERO reporter IP, User-Agent, or identity metadata
  db.insert(abuseReports)
    .values({
      linkId: targetLink.id,
      reason: data.reason,
      details: data.details?.trim() || null,
      status: "open",
      createdAt: now,
    })
    .run();

  // Personal admin links must never be disabled or auto-flagged by public reports
  if (targetLink.ownerType === "public" && targetLink.status === "active") {
    db.update(links)
      .set({ status: "flagged", updatedAt: now })
      .where(eq(links.id, targetLink.id))
      .run();
  }

  return NextResponse.json(
    {
      ok: true,
      message:
        "Report received anonymously. No reporter IP, cookie, or identity was logged.",
    },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}
