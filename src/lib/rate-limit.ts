import crypto from "node:crypto";

const ROTATION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_MAX_BUCKETS = 20_000;
const CLEANUP_BATCH_LIMIT = 128;

interface RateBucket {
  timestamps: number[];
  expiresAt: number;
}

let dailySecret: Buffer = crypto.randomBytes(32);
let secretCreatedAt = Date.now();

// Stores recent request timestamps per ephemeral HMAC key
const buckets = new Map<string, RateBucket>();

function rotateSecretIfNeeded(now: number): void {
  if (now - secretCreatedAt >= ROTATION_INTERVAL_MS) {
    dailySecret = crypto.randomBytes(32);
    secretCreatedAt = now;
    buckets.clear();
  }
}

/**
 * Computes an ephemeral HMAC-SHA256 identifier that never stores raw IPs
 * and becomes unlinkable every 24 hours when the in-memory secret rotates.
 */
export function hashEphemeralClientKey(
  bucket: string,
  clientIp: string,
  now = Date.now()
): string {
  rotateSecretIfNeeded(now);
  return crypto
    .createHmac("sha256", dailySecret)
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

function pruneExpiredBucketsBounded(now: number): void {
  let scanned = 0;
  for (const [k, entry] of buckets.entries()) {
    if (entry.expiresAt <= now) {
      buckets.delete(k);
    }
    scanned++;
    if (scanned >= CLEANUP_BATCH_LIMIT) {
      break;
    }
  }
}

export function checkRateLimit(
  bucket: string,
  clientIp: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
  maxBuckets = DEFAULT_MAX_BUCKETS
): RateLimitResult {
  const key = hashEphemeralClientKey(bucket, clientIp, now);
  const cutoff = now - windowMs;
  const existing = buckets.get(key);

  if (!existing && buckets.size >= maxBuckets) {
    pruneExpiredBucketsBounded(now);
    if (buckets.size >= maxBuckets) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000)),
      };
    }
  }

  const valid = existing
    ? existing.timestamps.filter((t) => t > cutoff)
    : [];

  if (limit <= 0 || valid.length >= limit) {
    // Re-insert so active keys move to the tail (LRU) and oldest entries stay at head
    if (existing) buckets.delete(key);
    buckets.set(key, { timestamps: valid, expiresAt: now + windowMs });
    const oldest = valid[0] ?? now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + windowMs - now) / 1000)
    );
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  valid.push(now);
  if (existing) buckets.delete(key);
  buckets.set(key, { timestamps: valid, expiresAt: now + windowMs });
  return {
    allowed: true,
    remaining: Math.max(0, limit - valid.length),
    retryAfterSeconds: 0,
  };
}

export function getRateLimiterStateForTesting() {
  return {
    secretCreatedAt,
    bucketCount: buckets.size,
  };
}

export function forceRotateRateLimiterForTesting(): void {
  dailySecret = crypto.randomBytes(32);
  secretCreatedAt = Date.now();
  buckets.clear();
}

export function resetRateLimiterForTesting(): void {
  buckets.clear();
}
