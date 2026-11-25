import crypto from "node:crypto";
import { getEnv, getPowSecret } from "./env";

const CHALLENGE_TTL_MS = 120_000; // 2 minutes
const DEFAULT_MAX_REPLAY_CACHE = 25_000;

// In-memory single-use replay guard: challengeId -> expiresAt
const usedChallenges = new Map<string, number>();

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

function pruneExpiredReplayRecords(now: number): void {
  for (const [id, exp] of usedChallenges.entries()) {
    if (exp <= now) {
      usedChallenges.delete(id);
    }
  }
}

export function verifyPowSolution(
  submission: PowSubmission,
  now = Date.now(),
  maxReplayCache = DEFAULT_MAX_REPLAY_CACHE
): { valid: boolean; reason?: string } {
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

  if (usedChallenges.has(submission.challengeId)) {
    return {
      valid: false,
      reason: "That request was already submitted. Please try again.",
    };
  }

  const digest = crypto
    .createHash("sha256")
    .update(`${submission.prefix}:${submission.nonce}`)
    .digest();

  if (countLeadingZeroBits(digest) < submission.difficulty) {
    return { valid: false, reason: "Security check failed. Please try again." };
  }

  if (usedChallenges.size >= maxReplayCache) {
    pruneExpiredReplayRecords(now);
    if (usedChallenges.size >= maxReplayCache) {
      return {
        valid: false,
        reason: "Too many requests right now. Please try again in a moment.",
      };
    }
  }

  usedChallenges.set(submission.challengeId, submission.expiresAt);
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

export function resetPowReplayCacheForTesting(): void {
  usedChallenges.clear();
}

export function getPowReplayCacheSizeForTesting(): number {
  return usedChallenges.size;
}
