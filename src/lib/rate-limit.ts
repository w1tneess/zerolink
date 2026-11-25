import crypto from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { getDb, type AppDatabase } from "@/db";
import { rateLimitHits } from "@/db/schema";
import { getPowSecret } from "./env";

const ROTATION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_MAX_BUCKETS = 20_000;

/**
 * Deterministic daily HMAC key. Deriving it from SESSION_SECRET means every
 * serverless instance rotates on the same schedule and never stores raw IPs.
 */
function dailySecret(now: number): Buffer {
  const day = Math.floor(now / ROTATION_INTERVAL_MS);
  return crypto
    .createHmac("sha256", getPowSecret())
    .update(`ratelimit-day:${day}`)
    .digest();
}

/** Computes an ephemeral identifier that becomes unlinkable when the day rotates. */
export function hashEphemeralClientKey(
  bucket: string,
  clientIp: string,
  now = Date.now()
): string {
  return crypto
    .createHmac("sha256", dailySecret(now))
    .update(`${bucket}:${clientIp}`)
    .digest("hex");
}

export function extractClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim().slice(0, 64);
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim().slice(0, 64);
  if (realIp) return realIp;
  return "127.0.0.1";
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

async function readHits(db: AppDatabase, key: string, cutoff: number) {
  const rows = await db
    .select({ createdAt: rateLimitHits.createdAt })
    .from(rateLimitHits)
    .where(and(eq(rateLimitHits.key, key), gt(rateLimitHits.createdAt, cutoff)))
    .orderBy(rateLimitHits.createdAt);
  return rows.map((row) => row.createdAt);
}

async function countBuckets(db: AppDatabase, cutoff: number): Promise<number> {
  const [{ count }] = await db
    .select({
      count: sql<number>`count(distinct ${rateLimitHits.key})::int`,
    })
    .from(rateLimitHits)
    .where(gt(rateLimitHits.createdAt, cutoff));
  return count;
}

async function evictColdBuckets(
  db: AppDatabase,
  cutoff: number,
  maxBuckets: number
): Promise<void> {
  await db.delete(rateLimitHits).where(sql`${rateLimitHits.createdAt} <= ${cutoff}`);
  await db.execute(sql.raw(
    `DELETE FROM rate_limit_hits WHERE key IN (
      SELECT key FROM rate_limit_hits GROUP BY key ORDER BY MAX(created_at) ASC OFFSET ${maxBuckets}
    )`
  ));
}

export async function checkRateLimit(
  bucket: string,
  clientIp: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
  maxBuckets = DEFAULT_MAX_BUCKETS
): Promise<RateLimitResult> {
  const key = hashEphemeralClientKey(bucket, clientIp, now);
  const cutoff = now - windowMs;
  const db = await getDb();

  // Prune stale hits first so bucket counts only reflect live activity.
  await db.delete(rateLimitHits).where(sql`${rateLimitHits.createdAt} <= ${cutoff}`);

  let valid = await readHits(db, key, cutoff);

  // A new bucket may only be admitted when there is room for it.
  if (valid.length === 0 && (await countBuckets(db, cutoff)) >= maxBuckets) {
    await evictColdBuckets(db, cutoff, maxBuckets);
    valid = await readHits(db, key, cutoff);
    if (valid.length === 0 && (await countBuckets(db, cutoff)) >= maxBuckets) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000)),
      };
    }
  }

  if (limit <= 0 || valid.length >= limit) {
    const oldest = valid[0] ?? now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((oldest + windowMs - now) / 1000)
      ),
    };
  }

  await db.insert(rateLimitHits).values({ key, createdAt: now });

  return {
    allowed: true,
    remaining: Math.max(0, limit - valid.length - 1),
    retryAfterSeconds: 0,
  };
}

export async function getRateLimiterStateForTesting(): Promise<{
  bucketCount: number;
}> {
  const db = await getDb();
  const rows = await db
    .select({ key: rateLimitHits.key })
    .from(rateLimitHits)
    .groupBy(rateLimitHits.key);
  return { bucketCount: rows.length };
}

export async function resetRateLimiterForTesting(): Promise<void> {
  const db = await getDb();
  await db.delete(rateLimitHits);
}
