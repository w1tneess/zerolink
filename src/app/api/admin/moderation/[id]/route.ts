import { NextRequest, NextResponse } from "next/server";
import { domainToASCII } from "node:url";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { abuseReports, blockedDomains, links } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/auth";

const moderateSchema = z.object({
  action: z.enum([
    "disable_link",
    "restore_link",
    "delete_link",
    "dismiss_report",
    "block_domain",
  ]),
  reportId: z.number().int().positive().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const linkId = Number.parseInt(id, 10);
  if (!Number.isInteger(linkId) || linkId <= 0) {
    return NextResponse.json({ error: "Invalid link ID." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = moderateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid moderation action." },
      { status: 400 }
    );
  }

  const db = await getDb();
  const linkRows = await db
    .select()
    .from(links)
    .where(eq(links.id, linkId))
    .limit(1);
  const link = linkRows[0];
  if (!link) {
    return NextResponse.json({ error: "Link not found." }, { status: 404 });
  }

  const now = Date.now();
  const { action, reportId } = parsed.data;

  if (action === "disable_link") {
    await db
      .update(links)
      .set({ status: "disabled", updatedAt: now })
      .where(eq(links.id, link.id));
    await db
      .update(abuseReports)
      .set({ status: "resolved" })
      .where(eq(abuseReports.linkId, link.id));
  } else if (action === "restore_link") {
    await db
      .update(links)
      .set({ status: "active", updatedAt: now })
      .where(eq(links.id, link.id));
    await db
      .update(abuseReports)
      .set({ status: "dismissed" })
      .where(eq(abuseReports.linkId, link.id));
  } else if (action === "delete_link") {
    await db.delete(links).where(eq(links.id, link.id));
  } else if (action === "dismiss_report") {
    let dismissError = false;
    if (reportId) {
      const updatedReport = await db
        .update(abuseReports)
        .set({ status: "dismissed" })
        .where(
          and(eq(abuseReports.id, reportId), eq(abuseReports.linkId, link.id))
        )
        .returning({ id: abuseReports.id });
      if (updatedReport.length === 0) {
        dismissError = true;
      }
    } else {
      await db
        .update(abuseReports)
        .set({ status: "dismissed" })
        .where(eq(abuseReports.linkId, link.id));
    }
    if (!dismissError && link.status === "flagged") {
      await db
        .update(links)
        .set({ status: "active", updatedAt: now })
        .where(eq(links.id, link.id));
    }
    if (dismissError) {
      return NextResponse.json(
        { error: "Report not found for this link." },
        { status: 404 }
      );
    }
  } else if (action === "block_domain") {
    let hostname: string;
    try {
      const rawHost = new URL(link.destinationUrl).hostname
        .toLowerCase()
        .replace(/\.+$/, "");
      hostname = (domainToASCII(rawHost) || rawHost).toLowerCase();
    } catch {
      return NextResponse.json(
        { error: "Cannot block domain: invalid destination URL." },
        { status: 400 }
      );
    }
    if (!hostname) {
      return NextResponse.json(
        { error: "Cannot block domain: missing hostname." },
        { status: 400 }
      );
    }

    await db
      .insert(blockedDomains)
      .values({
        domain: hostname,
        reason: `Blocked from moderation of /${link.slug}`,
        createdAt: now,
      })
      .onConflictDoNothing();

    if (link.ownerType === "public") {
      await db
        .update(links)
        .set({ status: "disabled", updatedAt: now })
        .where(eq(links.id, link.id));
    }
    await db
      .update(abuseReports)
      .set({ status: "resolved" })
      .where(eq(abuseReports.linkId, link.id));
  }

  return NextResponse.json(
    { ok: true },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
