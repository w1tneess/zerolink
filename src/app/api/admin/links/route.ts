import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { links } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/auth";
import { validateDestinationUrl } from "@/lib/security/url-validator";
import { validateCustomSlug } from "@/lib/security/slug-validator";
import {
  createLinkRecord,
  getLinkBySlug,
  resolveSafeRedirectCode,
  SlugTakenError,
} from "@/lib/links/service";

const createAdminLinkSchema = z.object({
  slug: z.string().max(64).optional().nullable(),
  destinationUrl: z.string().min(1).max(4096),
  redirectCode: z
    .union([z.literal(301), z.literal(302), z.literal(307)])
    .optional()
    .default(302),
  password: z.string().max(128).optional().nullable(),
  maxClicks: z.number().int().positive().max(1_000_000_000).optional().nullable(),
  expiresAt: z.number().int().positive().optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

function sanitizeLinkRow(row: typeof links.$inferSelect) {
  return {
    id: row.id,
    slug: row.slug,
    destinationUrl: row.destinationUrl,
    ownerType: row.ownerType,
    status: row.status,
    redirectCode: row.redirectCode,
    passwordProtected: Boolean(row.passwordHash),
    clicks: row.clicks,
    maxClicks: row.maxClicks,
    expiresAt: row.expiresAt,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const rows = db
    .select()
    .from(links)
    .where(eq(links.ownerType, "admin"))
    .orderBy(desc(links.createdAt))
    .all();

  return NextResponse.json(
    { links: rows.map(sanitizeLinkRow) },
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

  const parsed = createAdminLinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid link fields." },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const urlCheck = validateDestinationUrl(data.destinationUrl, {
    requestHost: request.headers.get("host"),
  });
  if (!urlCheck.valid || !urlCheck.url) {
    return NextResponse.json({ error: urlCheck.error }, { status: 400 });
  }

  let customSlug: string | undefined;
  if (data.slug && data.slug.trim().length > 0) {
    const slugCheck = validateCustomSlug(data.slug);
    if (!slugCheck.valid || !slugCheck.slug) {
      return NextResponse.json({ error: slugCheck.error }, { status: 400 });
    }
    if (getLinkBySlug(slugCheck.slug)) {
      return NextResponse.json(
        { error: `Ending "/${slugCheck.slug}" is already in use.` },
        { status: 409 }
      );
    }
    customSlug = slugCheck.slug;
  }

  if (
    data.redirectCode === 301 &&
    (data.expiresAt != null || data.maxClicks != null)
  ) {
    return NextResponse.json(
      {
        error:
          "Permanent links can't be combined with an expiration date or visit limit. Choose Standard or Temporary instead.",
      },
      { status: 400 }
    );
  }

  let created;
  try {
    created = createLinkRecord({
      slug: customSlug,
      destinationUrl: urlCheck.url,
      ownerType: "admin",
      redirectCode: resolveSafeRedirectCode(
        data.redirectCode,
        data.expiresAt,
        data.maxClicks
      ),
      password: data.password?.trim() || null,
      maxClicks: data.maxClicks ?? null,
      expiresAt: data.expiresAt ?? null,
      note: data.note?.trim() || null,
    });
  } catch (err) {
    if (err instanceof SlugTakenError) {
      return NextResponse.json(
        { error: `Ending "/${err.slug}" is already in use.` },
        { status: 409 }
      );
    }
    throw err;
  }

  return NextResponse.json(
    { link: sanitizeLinkRow(created) },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}
