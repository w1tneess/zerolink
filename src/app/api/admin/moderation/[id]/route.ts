import { NextRequest, NextResponse } from "next/server";
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

  const db = getDb();
  const link = db.select().from(links).where(eq(links.id, linkId)).get();
  if (!link) {
    return NextResponse.json({ error: "Link not found." }, { status: 404 });
  }

  const now = Date.now();
  const { action, reportId } = parsed.data;

  if (action === "disable_link") {
    db.update(links)
      .set({ status: "disabled", updatedAt: now })
      .where(eq(links.id, link.id))
      .run();
    db.update(abuseReports)
      .set({ status: "resolved" })
      .where(eq(abuseReports.linkId, link.id))
      .run();
  } else if (action === "restore_link") {
    db.update(links)
      .set({ status: "active", updatedAt: now })
      .where(eq(links.id, link.id))
      .run();
    db.update(abuseReports)
      .set({ status: "dismissed" })
      .where(eq(abuseReports.linkId, link.id))
      .run();
  } else if (action === "delete_link") {
    db.delete(links).where(eq(links.id, link.id)).run();
  } else if (action === "dismiss_report") {
    if (reportId) {
      const updatedReport = db
        .update(abuseReports)
        .set({ status: "dismissed" })
        .where(
          and(
            eq(abuseReports.id, reportId),
            eq(abuseReports.linkId, link.id)
          )
        )
        .returning({ id: abuseReports.id })
        .get();
      if (!updatedReport) {
        return NextResponse.json(
          { error: "Report not found for this link." },
          { status: 404 }
        );
      }
    } else {
      db.update(abuseReports)
        .set({ status: "dismissed" })
        .where(eq(abuseReports.linkId, link.id))
        .run();
    }
    if (link.status === "flagged") {
      db.update(links)
        .set({ status: "active", updatedAt: now })
        .where(eq(links.id, link.id))
        .run();
    }
  } else if (action === "block_domain") {
    let hostname: string;
    try {
      hostname = new URL(link.destinationUrl).hostname
        .toLowerCase()
        .replace(/\.+$/, "");
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

    db.insert(blockedDomains)
      .values({
        domain: hostname,
        reason: `Blocked from moderation of /${link.slug}`,
        createdAt: now,
      })
      .onConflictDoNothing()
      .run();

    if (link.ownerType === "public") {
      db.update(links)
        .set({ status: "disabled", updatedAt: now })
        .where(eq(links.id, link.id))
        .run();
    }
    db.update(abuseReports)
      .set({ status: "resolved" })
      .where(eq(abuseReports.linkId, link.id))
      .run();
  }

  return NextResponse.json(
    { ok: true },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
