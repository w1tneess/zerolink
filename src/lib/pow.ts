import crypto from "node:crypto";
import { gt, lte, sql } from "drizzle-orm";
import { getDb, type AppDatabase } from "@/db";
import { powUsedChallenges } from "@/db/schema";
import { getEnv, getPowSecret } from "./env";

const CHALLENGE_TTL_MS = 120_000; // 2 minutes
const DEFAULT_MAX_REPLAY_CACHE = 25_000;
const CLEANUP_INTERVAL_MS = 60_000;

let lastCleanupAt = 0;

export interface PowChallenge {
  challengeId: string;
  prefix: string;
  difficulty: number;
  expiresAt: number;
  sig: string;
}

export interface PowSubmission {
  challengeId: string;
  prefix: string;
  difficulty: number;
  expiresAt: number;
  sig: string;
  nonce: string;
}

function signChallengeFields(
  challengeId: string,
  prefix: string,
  difficulty: number,
  expiresAt: number
): string {
  const payload = `${challengeId}|${prefix}|${difficulty}|${expiresAt}`;
  return crypto
    .createHmac("sha256", getPowSecret())
    .update(payload)
    .digest("hex");
}

export function countLeadingZeroBits(buf: Buffer): number {
  let bits = 0;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    if (byte === 0) {
      bits += 8;
    } else {
      bits += Math.clz32(byte) - 24;
      break;
    }
  }
  return bits;
}

export function issuePowChallenge(customDifficulty?: number): PowChallenge {
  const env = getEnv();
  const difficulty = customDifficulty ?? env.POW_DIFFICULTY;
  const challengeId = crypto.randomBytes(16).toString("hex");
  const prefix = crypto.randomBytes(16).toString("hex");
  const expiresAt = Date.now() + CHALLENGE_TTL_MS;
  const sig = signChallengeFields(challengeId, prefix, difficulty, expiresAt);
  return { challengeId, prefix, difficulty, expiresAt, sig };
}

async function pruneExpired(db: AppDatabase, now: number): Promise<void> {
  const wallClock = Date.now();
  if (wallClock - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = wallClock;
  await db.delete(powUsedChallenges).where(lte(powUsedChallenges.expiresAt, now));
}

export async function verifyPowSolution(
  submission: PowSubmission,
  now = Date.now(),
  maxReplayCache = DEFAULT_MAX_REPLAY_CACHE
): Promise<{ valid: boolean; reason?: string }> {
  const env = getEnv();
  if (
    !submission.challengeId ||
    !submission.prefix ||
    !submission.sig ||
    typeof submission.nonce !== "string" ||
    submission.nonce.length === 0 ||
    submission.nonce.length > 64
  ) {
    return { valid: false, reason: "Security check failed. Please try again." };
  }

  if (
    !Number.isInteger(submission.difficulty) ||
    submission.difficulty < env.POW_DIFFICULTY ||
    submission.difficulty > 24
  ) {
    return { valid: false, reason: "Security check failed. Please try again." };
  }

  if (now > submission.expiresAt) {
    return {
      valid: false,
      reason: "The quick spam check expired. Please try again.",
    };
  }

  const expectedSig = signChallengeFields(
    submission.challengeId,
    submission.prefix,
    submission.difficulty,
    submission.expiresAt
  );

  const sigBuf = Buffer.from(submission.sig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return { valid: false, reason: "Security check failed. Please try again." };
  }

  const digest = crypto
    .createHash("sha256")
    .update(`${submission.prefix}:${submission.nonce}`)
    .digest();

  if (countLeadingZeroBits(digest) < submission.difficulty) {
    return { valid: false, reason: "Security check failed. Please try again." };
  }

  const db = await getDb();
  await pruneExpired(db, now);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(powUsedChallenges)
    .where(gt(powUsedChallenges.expiresAt, now));

  if (count >= maxReplayCache) {
    await db.delete(powUsedChallenges).where(lte(powUsedChallenges.expiresAt, now));
    return {
      valid: false,
      reason: "Too many requests right now. Please try again in a moment.",
    };
  }

  // Atomic claim: only one invocation can insert a given challengeId.
  const claimed = await db
    .insert(powUsedChallenges)
    .values({
      challengeId: submission.challengeId,
      expiresAt: submission.expiresAt,
    })
    .onConflictDoNothing()
    .returning({ challengeId: powUsedChallenges.challengeId });

  if (claimed.length === 0) {
    return {
      valid: false,
      reason: "That request was already submitted. Please try again.",
    };
  }

  return { valid: true };
}

export function solvePowChallenge(challenge: PowChallenge): PowSubmission {
  let nonce = 0;
  while (true) {
    const candidate = nonce.toString(36);
    const digest = crypto
      .createHash("sha256")
      .update(`${challenge.prefix}:${candidate}`)
      .digest();
    if (countLeadingZeroBits(digest) >= challenge.difficulty) {
      return {
        ...challenge,
        nonce: candidate,
      };
    }
    nonce++;
  }
}

export async function resetPowReplayCacheForTesting(): Promise<void> {
  const db = await getDb();
  await db.delete(powUsedChallenges);
  lastCleanupAt = 0;
}

export async function getPowReplayCacheSizeForTesting(): Promise<number> {
  const db = await getDb();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(powUsedChallenges);
  return count;
}
