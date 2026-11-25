import { eq, sql, desc } from "drizzle-orm";
import { getDb, DEFAULT_SETTINGS } from "@/db";
import {
  links,
  blockedDomains,
  settings,
  abuseReports,
  type LinkRecord,
} from "@/db/schema";
import { generateBase62Slug, hashPassword } from "@/lib/crypto";
import { getEnv } from "@/lib/env";

export interface AppSettings {
  publicCreationEnabled: boolean;
  anonymousClickCounting: boolean;
  defaultPublicExpiryHours: number;
  allowPublicCustomSlugs: boolean;
}

export async function getAppSettings(): Promise<AppSettings> {
  const db = getDb();
  const rows = db.select().from(settings).all();
  const map = new Map<string, string>(Object.entries(DEFAULT_SETTINGS));
  for (const row of rows) {
    map.set(row.key, row.value);
  }

  const expiryHours = Number.parseInt(
    map.get("default_public_expiry_hours") ?? "720",
    10
  );

  return {
    publicCreationEnabled: map.get("public_creation_enabled") === "true",
    anonymousClickCounting: map.get("anonymous_click_counting") === "true",
    defaultPublicExpiryHours:
      Number.isFinite(expiryHours) && expiryHours > 0 ? expiryHours : 720,
    allowPublicCustomSlugs: map.get("allow_public_custom_slugs") === "true",
  };
}

export async function updateAppSettings(
  updates: Partial<AppSettings>
): Promise<AppSettings> {
  const db = getDb();
  const now = Date.now();
  const pairs: Array<[string, string]> = [];

  if (typeof updates.publicCreationEnabled === "boolean") {
    pairs.push([
      "public_creation_enabled",
      String(updates.publicCreationEnabled),
    ]);
  }
  if (typeof updates.anonymousClickCounting === "boolean") {
    pairs.push([
      "anonymous_click_counting",
      String(updates.anonymousClickCounting),
    ]);
  }
  if (typeof updates.defaultPublicExpiryHours === "number") {
    pairs.push([
      "default_public_expiry_hours",
      String(Math.max(1, Math.floor(updates.defaultPublicExpiryHours))),
    ]);
  }
  if (typeof updates.allowPublicCustomSlugs === "boolean") {
    pairs.push([
      "allow_public_custom_slugs",
      String(updates.allowPublicCustomSlugs),
    ]);
  }

  for (const [key, value] of pairs) {
    db.insert(settings)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value, updatedAt: now },
      })
      .run();
  }

  return getAppSettings();
}

export async function getBlockedDomainsList(): Promise<string[]> {
  const db = getDb();
  const rows = db.select({ domain: blockedDomains.domain }).from(blockedDomains).all();
  return rows.map((r) => r.domain);
}

/**
 * Enforces redirect caching safety:
 * Links with an expiry or click cap must never use 301 permanent redirects.
 */
export function resolveSafeRedirectCode(
  requestedCode: number | undefined,
  expiresAt: number | null | undefined,
  maxClicks: number | null | undefined
): 301 | 302 | 307 {
  const defaultCode = getEnv().DEFAULT_REDIRECT_CODE;
  const candidate =
    requestedCode === 301 || requestedCode === 302 || requestedCode === 307
      ? requestedCode
      : defaultCode;

  const hasLimits =
    (expiresAt !== null && expiresAt !== undefined) ||
    (maxClicks !== null && maxClicks !== undefined);

  if (hasLimits && candidate === 301) {
    return 302;
  }
  return candidate;
}

export type LinkAvailability =
  | { available: true; link: LinkRecord }
  | {
      available: false;
      reason: "not_found" | "disabled" | "flagged" | "expired" | "max_clicks";
      link?: LinkRecord;
    };

export function checkLinkAvailability(
  link: LinkRecord | undefined,
  now = Date.now()
): LinkAvailability {
  if (!link) {
    return { available: false, reason: "not_found" };
  }
  if (link.status === "disabled") {
    return { available: false, reason: "disabled", link };
  }
  if (link.status === "flagged") {
    return { available: false, reason: "flagged", link };
  }
  if (link.expiresAt !== null && link.expiresAt <= now) {
    return { available: false, reason: "expired", link };
  }
  if (link.maxClicks !== null && link.clicks >= link.maxClicks) {
    return { available: false, reason: "max_clicks", link };
  }
  return { available: true, link };
}

export function getLinkBySlug(slug: string): LinkRecord | undefined {
  const db = getDb();
  return db.select().from(links).where(eq(links.slug, slug)).get();
}

export async function incrementAnonymousClick(linkId: number): Promise<void> {
  const appSettings = await getAppSettings();
  if (!appSettings.anonymousClickCounting) {
    return;
  }
  const db = getDb();
  db.update(links)
    .set({ clicks: sql`${links.clicks} + 1` })
    .where(eq(links.id, linkId))
    .run();
}

export class SlugTakenError extends Error {
  readonly slug: string;

  constructor(slug: string) {
    super(`Slug "${slug}" is already taken.`);
    this.name = "SlugTakenError";
    this.slug = slug;
  }
}

export interface CreateLinkInput {
  slug?: string;
  destinationUrl: string;
  ownerType: "admin" | "public";
  redirectCode?: 301 | 302 | 307;
  password?: string | null;
  maxClicks?: number | null;
  expiresAt?: number | null;
  note?: string | null;
}

export function createLinkRecord(input: CreateLinkInput): LinkRecord {
  const db = getDb();
  const now = Date.now();
  const passwordHash =
    input.password && input.password.length > 0
      ? hashPassword(input.password)
      : null;

  const redirectCode = resolveSafeRedirectCode(
    input.redirectCode,
    input.expiresAt,
    input.maxClicks
  );

  // If explicit slug provided, insert directly
  if (input.slug) {
    try {
      const inserted = db
        .insert(links)
        .values({
          slug: input.slug,
          destinationUrl: input.destinationUrl,
          ownerType: input.ownerType,
          status: "active",
          redirectCode,
          passwordHash,
          clicks: 0,
          maxClicks: input.maxClicks ?? null,
          expiresAt: input.expiresAt ?? null,
          note: input.note ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();
      return inserted;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("UNIQUE") || msg.includes("constraint")) {
        throw new SlugTakenError(input.slug);
      }
      throw err;
    }
  }

  // Generate random 7-char Base62 slug with collision retries
  for (let attempt = 0; attempt < 8; attempt++) {
    const length = attempt < 5 ? 7 : 8;
    const candidate = generateBase62Slug(length);
    try {
      const inserted = db
        .insert(links)
        .values({
          slug: candidate,
          destinationUrl: input.destinationUrl,
          ownerType: input.ownerType,
          status: "active",
          redirectCode,
          passwordHash,
          clicks: 0,
          maxClicks: input.maxClicks ?? null,
          expiresAt: input.expiresAt ?? null,
          note: input.note ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();
      return inserted;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("UNIQUE") || msg.includes("constraint")) {
        continue;
      }
      throw err;
    }
  }

  throw new Error("Failed to allocate unique short slug after retries.");
}

export function listAllPublicAndFlaggedLinks() {
  const db = getDb();
  const publicLinks = db
    .select()
    .from(links)
    .where(eq(links.ownerType, "public"))
    .orderBy(desc(links.createdAt))
    .all();

  const openReports = db
    .select({
      reportId: abuseReports.id,
      linkId: abuseReports.linkId,
      reason: abuseReports.reason,
      details: abuseReports.details,
      reportStatus: abuseReports.status,
      reportCreatedAt: abuseReports.createdAt,
      slug: links.slug,
      destinationUrl: links.destinationUrl,
      ownerType: links.ownerType,
      linkStatus: links.status,
    })
    .from(abuseReports)
    .innerJoin(links, eq(abuseReports.linkId, links.id))
    .orderBy(desc(abuseReports.createdAt))
    .all();

  return { publicLinks, reports: openReports };
}
