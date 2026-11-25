import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetDbForTesting } from "@/db";
import {
  getPowReplayCacheSizeForTesting,
  issuePowChallenge,
  resetPowReplayCacheForTesting,
  solvePowChallenge,
  verifyPowSolution,
} from "@/lib/pow";
import {
  checkRateLimit,
  getRateLimiterStateForTesting,
  hashEphemeralClientKey,
  resetRateLimiterForTesting,
} from "@/lib/rate-limit";

const DAY_MS = 24 * 60 * 60 * 1000;

beforeAll(() => {
  process.env.DATABASE_DRIVER = "pglite";
  process.env.DATABASE_URL = "memory://";
  process.env.SESSION_SECRET = "test-session-secret-0123456789abcdef";
  process.env.POW_DIFFICULTY = "16";
});

beforeEach(async () => {
  await resetDbForTesting();
  await resetPowReplayCacheForTesting();
  await resetRateLimiterForTesting();
});

describe("Proof-of-Work Hashcash", () => {
  it("verifies a validly solved challenge and blocks replay across instances", async () => {
    const solved = solvePowChallenge(issuePowChallenge(16));

    expect((await verifyPowSolution(solved)).valid).toBe(true);
    expect((await verifyPowSolution(solved)).valid).toBe(false);
    expect(await getPowReplayCacheSizeForTesting()).toBe(1);
  });

  it("rejects tampered signatures and expired challenges", async () => {
    const solved = solvePowChallenge(issuePowChallenge(16));

    const tampered = { ...solved, prefix: "deadbeef" };
    expect((await verifyPowSolution(tampered)).valid).toBe(false);

    const expired = await verifyPowSolution(solved, solved.expiresAt + 5000);
    expect(expired.valid).toBe(false);
  });

  it("retains live replay records when the shared cache reaches capacity", async () => {
    const s1 = solvePowChallenge(issuePowChallenge(16));
    const s2 = solvePowChallenge(issuePowChallenge(16));
    const s3 = solvePowChallenge(issuePowChallenge(16));

    expect((await verifyPowSolution(s1, Date.now(), 2)).valid).toBe(true);
    expect((await verifyPowSolution(s2, Date.now(), 2)).valid).toBe(true);
    expect(await getPowReplayCacheSizeForTesting()).toBe(2);

    // Cache is full of unexpired records: a new submission is refused.
    expect((await verifyPowSolution(s3, Date.now(), 2)).valid).toBe(false);
    expect(await getPowReplayCacheSizeForTesting()).toBe(2);
  });
});

describe("Zero-Tracking Ephemeral Rate Limiter", () => {
  it("enforces sliding window limit per ephemeral key", async () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < 3; i++) {
      const res = await checkRateLimit("test_bucket", "203.0.113.10", 3, 60_000, now + i);
      expect(res.allowed).toBe(true);
    }

    const blocked = await checkRateLimit("test_bucket", "203.0.113.10", 3, 60_000, now + 10);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    // Different IP gets its own ephemeral bucket
    const other = await checkRateLimit("test_bucket", "203.0.113.11", 3, 60_000, now + 10);
    expect(other.allowed).toBe(true);
  });

  it("rotates the HMAC key daily so historical IPs cannot be correlated", () => {
    const now = 1_700_000_000_000;
    const before = hashEphemeralClientKey("shorten", "203.0.113.55", now);
    const after = hashEphemeralClientKey("shorten", "203.0.113.55", now + DAY_MS);
    expect(before).not.toContain("203.0.113.55");
    expect(after).not.toBe(before);
  });

  it("enforces maxBuckets on active saturation", async () => {
    const now = 1_700_000_000_000;
    expect((await checkRateLimit("b", "198.51.100.1", 2, 1000, now, 2)).allowed).toBe(true);
    expect((await checkRateLimit("b", "198.51.100.2", 2, 1000, now, 2)).allowed).toBe(true);

    // Active saturation: unseen IP rejected and bucket count remains capped at 2
    const rejected = await checkRateLimit("b", "198.51.100.3", 2, 1000, now + 100, 2);
    expect(rejected.allowed).toBe(false);
    expect((await getRateLimiterStateForTesting()).bucketCount).toBe(2);

    // Existing active bucket preserves its count (2nd allowed, 3rd blocked)
    expect((await checkRateLimit("b", "198.51.100.1", 2, 1000, now + 100, 2)).allowed).toBe(true);
    expect((await checkRateLimit("b", "198.51.100.1", 2, 1000, now + 100, 2)).allowed).toBe(false);

    // Once previous buckets expire, new IP succeeds via bounded cleanup
    const afterExpiry = await checkRateLimit("b", "198.51.100.3", 2, 1000, now + 2000, 2);
    expect(afterExpiry.allowed).toBe(true);
    expect((await getRateLimiterStateForTesting()).bucketCount).toBe(1);
  });

  it("evicts expired buckets while keeping renewed active buckets", async () => {
    const now = 1_700_000_000_000;
    expect((await checkRateLimit("b", "198.51.100.10", 5, 1000, now, 2)).allowed).toBe(true);
    expect((await checkRateLimit("b", "198.51.100.11", 5, 1000, now + 50, 2)).allowed).toBe(true);

    // Renew ip-1 at t=now+600 so ip-2 becomes the oldest bucket
    expect((await checkRateLimit("b", "198.51.100.10", 5, 1000, now + 600, 2)).allowed).toBe(true);

    // At t=now+1100, ip-2 is expired while ip-1 is still active
    expect((await checkRateLimit("b", "198.51.100.12", 5, 1000, now + 1100, 2)).allowed).toBe(true);
    expect((await getRateLimiterStateForTesting()).bucketCount).toBe(2);
  });
});
