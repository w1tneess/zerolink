import { beforeEach, describe, expect, it } from "vitest";
import {
  getPowReplayCacheSizeForTesting,
  issuePowChallenge,
  resetPowReplayCacheForTesting,
  solvePowChallenge,
  verifyPowSolution,
} from "@/lib/pow";
import {
  checkRateLimit,
  forceRotateRateLimiterForTesting,
  getRateLimiterStateForTesting,
  hashEphemeralClientKey,
  resetRateLimiterForTesting,
} from "@/lib/rate-limit";

describe("Proof-of-Work Hashcash", () => {
  beforeEach(() => {
    resetPowReplayCacheForTesting();
  });

  it("verifies a validly solved challenge and blocks replay", () => {
    const challenge = issuePowChallenge(16);
    const solved = solvePowChallenge(challenge);

    const first = verifyPowSolution(solved);
    expect(first.valid).toBe(true);

    // Replay of the same challengeId must fail
    const replay = verifyPowSolution(solved);
    expect(replay.valid).toBe(false);
  });

  it("rejects tampered signatures and expired challenges", () => {
    const challenge = issuePowChallenge(16);
    const solved = solvePowChallenge(challenge);

    const tampered = { ...solved, prefix: "deadbeef" };
    expect(verifyPowSolution(tampered).valid).toBe(false);

    const expired = verifyPowSolution(solved, solved.expiresAt + 5000);
    expect(expired.valid).toBe(false);
  });

  it("retains live replay records when cache reaches capacity", () => {
    const s1 = solvePowChallenge(issuePowChallenge(16));
    const s2 = solvePowChallenge(issuePowChallenge(16));
    const s3 = solvePowChallenge(issuePowChallenge(16));

    expect(verifyPowSolution(s1, Date.now(), 2).valid).toBe(true);
    expect(verifyPowSolution(s2, Date.now(), 2).valid).toBe(true);
    expect(getPowReplayCacheSizeForTesting()).toBe(2);

    // Cache is full of unexpired records: new submission fails without clearing s1/s2
    expect(verifyPowSolution(s3, Date.now(), 2).valid).toBe(false);
    expect(getPowReplayCacheSizeForTesting()).toBe(2);
    expect(verifyPowSolution(s1, Date.now(), 2).valid).toBe(false);
  });
});

describe("Zero-Tracking Ephemeral Rate Limiter", () => {
  beforeEach(() => {
    resetRateLimiterForTesting();
  });

  it("enforces sliding window limit per ephemeral key", () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < 3; i++) {
      const res = checkRateLimit("test_bucket", "203.0.113.10", 3, 60_000, now + i);
      expect(res.allowed).toBe(true);
    }

    const blocked = checkRateLimit("test_bucket", "203.0.113.10", 3, 60_000, now + 10);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    // Different IP gets its own ephemeral bucket
    const other = checkRateLimit("test_bucket", "203.0.113.11", 3, 60_000, now + 10);
    expect(other.allowed).toBe(true);
  });

  it("rotates ephemeral HMAC key so historical IPs cannot be correlated", () => {
    const hashBefore = hashEphemeralClientKey("shorten", "203.0.113.55");
    expect(hashBefore).not.toContain("203.0.113.55");
    forceRotateRateLimiterForTesting();
    const hashAfter = hashEphemeralClientKey("shorten", "203.0.113.55");
    expect(hashAfter).not.toBe(hashBefore);
  });

  it("enforces maxBuckets on active saturation while pruning expired buckets", () => {
    const now = 1_700_000_000_000;
    expect(checkRateLimit("b", "198.51.100.1", 2, 1000, now, 2).allowed).toBe(true);
    expect(checkRateLimit("b", "198.51.100.2", 2, 1000, now, 2).allowed).toBe(true);

    // Active saturation: unseen IP rejected and bucket count remains capped at 2
    const rejected = checkRateLimit("b", "198.51.100.3", 2, 1000, now + 100, 2);
    expect(rejected.allowed).toBe(false);
    expect(getRateLimiterStateForTesting().bucketCount).toBe(2);

    // Existing active bucket preserves its count (2nd allowed, 3rd blocked)
    expect(checkRateLimit("b", "198.51.100.1", 2, 1000, now + 100, 2).allowed).toBe(true);
    expect(checkRateLimit("b", "198.51.100.1", 2, 1000, now + 100, 2).allowed).toBe(false);

    // Once previous buckets expire, new IP succeeds via bounded cleanup
    const afterExpiry = checkRateLimit("b", "198.51.100.3", 2, 1000, now + 2000, 2);
    expect(afterExpiry.allowed).toBe(true);
    expect(getRateLimiterStateForTesting().bucketCount).toBe(1);
  });

  it("prunes expired buckets behind renewed active buckets via LRU order", () => {
    const now = 1_700_000_000_000;
    // Create ip-1 and ip-2 at t=now (window 1000ms)
    expect(checkRateLimit("b", "198.51.100.10", 5, 1000, now, 2).allowed).toBe(true);
    expect(checkRateLimit("b", "198.51.100.11", 5, 1000, now + 50, 2).allowed).toBe(true);

    // Renew ip-1 at t=now+600 so ip-2 becomes oldest
    expect(checkRateLimit("b", "198.51.100.10", 5, 1000, now + 600, 2).allowed).toBe(true);

    // At t=now+1100, ip-2 is expired while ip-1 is still active; ip-3 should evict expired ip-2
    expect(checkRateLimit("b", "198.51.100.12", 5, 1000, now + 1100, 2).allowed).toBe(true);
    expect(getRateLimiterStateForTesting().bucketCount).toBe(2);
  });
});
