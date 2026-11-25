import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { abuseReports, links } from "@/db/schema";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";
import { verifyPowSolution } from "@/lib/pow";
import { getLinkBySlug } from "@/lib/links/service";
import { safeDecodeURIComponent } from "@/lib/security/slug-validator";

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
  let pathPart = trimmed;
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      pathPart = new URL(trimmed).pathname;
    }
  } catch {
    // fall through to path parsing
  }
  const cleanPath = pathPart.split("?")[0].split("#")[0].replace(/^\/+/, "");
  const segments = cleanPath.split("/").filter(Boolean);
  if (segments.length === 0) return "";
  const rawSeg =
    (segments[0] === "inspect" || segments[0] === "unlock") && segments[1]
      ? segments[1]
      : segments[0];
  return safeDecodeURIComponent(rawSeg).replace(/\+$/, "");
}

export async function POST(request: NextRequest) {
  const ip = extractClientIp(request);
  const rate = await checkRateLimit("public_report", ip, 10, 15 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: `Too many reports right now. Please wait ${rate.retryAfterSeconds}s and try again.`,
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
    return NextResponse.json(
      { error: "Something looked off in that request. Please try again." },
      { status: 400 }
    );
  }

  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please enter a short link and choose a reason for your report." },
      { status: 400 }
    );
  }

  const data = parsed.data;

  if (data.website && data.website.trim().length > 0) {
    return NextResponse.json(
      { error: "Request blocked by spam protection." },
      { status: 400 }
    );
  }

  const powCheck = await verifyPowSolution(data.pow);
  if (!powCheck.valid) {
    return NextResponse.json(
      { error: powCheck.reason ?? "Security check failed. Please try again." },
      { status: 403 }
    );
  }

  const slug = extractSlug(data.slugOrUrl);
  if (!slug) {
    return NextResponse.json(
      { error: "We couldn't read that short link. Paste the full link or its short ending." },
      { status: 400 }
    );
  }

  const targetLink = await getLinkBySlug(slug);
  if (!targetLink) {
    return NextResponse.json(
      { error: `We couldn't find a short link for "/${slug}".` },
      { status: 404 }
    );
  }

  const db = await getDb();
  const now = Date.now();

  // Store report with ZERO reporter IP, User-Agent, or identity metadata
  await db.insert(abuseReports).values({
    linkId: targetLink.id,
    reason: data.reason,
    details: data.details?.trim() || null,
    status: "open",
    createdAt: now,
  });

  // Personal admin links must never be disabled or auto-flagged by public reports
  if (targetLink.ownerType === "public" && targetLink.status === "active") {
    await db
      .update(links)
      .set({ status: "flagged", updatedAt: now })
      .where(eq(links.id, targetLink.id));
  }

  return NextResponse.json(
    {
      ok: true,
      message:
        "Thanks — your report was sent anonymously. No personal details or IP address were saved.",
    },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}
