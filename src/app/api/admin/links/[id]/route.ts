import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { links } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/auth";
import { hashPassword } from "@/lib/crypto";
import { validateDestinationUrl } from "@/lib/security/url-validator";
import { validateCustomSlug } from "@/lib/security/slug-validator";
import { resolveSafeRedirectCode } from "@/lib/links/service";

const patchLinkSchema = z.object({
  slug: z.string().min(2).max(64).optional(),
  destinationUrl: z.string().min(1).max(4096).optional(),
  redirectCode: z.union([z.literal(301), z.literal(302), z.literal(307)]).optional(),
  status: z.enum(["active", "disabled", "flagged"]).optional(),
  password: z.string().max(128).optional().nullable(),
  clearPassword: z.boolean().optional(),
  maxClicks: z.number().int().positive().max(1_000_000_000).nullable().optional(),
  expiresAt: z.number().int().positive().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

export async function PATCH(
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

  const parsed = patchLinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update payload." }, { status: 400 });
  }

  const data = parsed.data;
  const db = getDb();
  const existing = db.select().from(links).where(eq(links.id, linkId)).get();
  if (!existing) {
    return NextResponse.json({ error: "Link not found." }, { status: 404 });
  }

  const updates: Partial<typeof links.$inferInsert> = {
    updatedAt: Date.now(),
  };

  if (data.slug !== undefined && data.slug !== existing.slug) {
    const slugCheck = validateCustomSlug(data.slug);
    if (!slugCheck.valid || !slugCheck.slug) {
      return NextResponse.json({ error: slugCheck.error }, { status: 400 });
    }
    const collision = db
      .select({ id: links.id })
      .from(links)
      .where(eq(links.slug, slugCheck.slug))
      .get();
    if (collision && collision.id !== existing.id) {
      return NextResponse.json(
        { error: `Ending "/${slugCheck.slug}" is already taken.` },
        { status: 409 }
      );
    }
    updates.slug = slugCheck.slug;
  }

  if (data.destinationUrl !== undefined) {
    const urlCheck = validateDestinationUrl(data.destinationUrl, {
      requestHost: request.headers.get("host"),
    });
    if (!urlCheck.valid || !urlCheck.url) {
      return NextResponse.json({ error: urlCheck.error }, { status: 400 });
    }
    updates.destinationUrl = urlCheck.url;
  }

  const nextExpiresAt =
    data.expiresAt !== undefined ? data.expiresAt : existing.expiresAt;
  const nextMaxClicks =
    data.maxClicks !== undefined ? data.maxClicks : existing.maxClicks;
  const requestedCode = data.redirectCode ?? existing.redirectCode;

  if (
    data.redirectCode === 301 &&
    (nextExpiresAt !== null || nextMaxClicks !== null)
  ) {
    return NextResponse.json(
      {
        error:
          "Permanent links can't be combined with an expiration date or visit limit. Choose Standard or Temporary instead.",
      },
      { status: 400 }
    );
  }

  if (data.expiresAt !== undefined) {
    updates.expiresAt = data.expiresAt;
  }
  if (data.maxClicks !== undefined) {
    updates.maxClicks = data.maxClicks;
  }

  const safeCode = resolveSafeRedirectCode(
    requestedCode,
    nextExpiresAt,
    nextMaxClicks
  );
  if (data.redirectCode !== undefined || safeCode !== existing.redirectCode) {
    updates.redirectCode = safeCode;
  }

  if (data.status !== undefined) {
    updates.status = data.status;
  }
  if (data.note !== undefined) {
    updates.note = data.note?.trim() || null;
  }
  if (data.clearPassword) {
    updates.passwordHash = null;
  } else if (data.password && data.password.trim().length > 0) {
    updates.passwordHash = hashPassword(data.password.trim());
  }

  const updated = db
    .update(links)
    .set(updates)
    .where(eq(links.id, existing.id))
    .returning()
    .get();

  return NextResponse.json(
    {
      link: {
        id: updated.id,
        slug: updated.slug,
        destinationUrl: updated.destinationUrl,
        ownerType: updated.ownerType,
        status: updated.status,
        redirectCode: updated.redirectCode,
        passwordProtected: Boolean(updated.passwordHash),
        clicks: updated.clicks,
        maxClicks: updated.maxClicks,
        expiresAt: updated.expiresAt,
        note: updated.note,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE(
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

  const db = getDb();
  const deleted = db
    .delete(links)
    .where(eq(links.id, linkId))
    .returning({ id: links.id })
    .get();

  if (!deleted) {
    return NextResponse.json({ error: "Link not found." }, { status: 404 });
  }

  return NextResponse.json(
    { ok: true, id: deleted.id },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
