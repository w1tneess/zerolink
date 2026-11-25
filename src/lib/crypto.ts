import crypto from "node:crypto";

const BASE62_ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Generates a cryptographically random Base62 slug without modulo bias.
 */
export function generateBase62Slug(length = 7): string {
  const result: string[] = [];
  // 62 * 4 = 248; reject bytes >= 248 to eliminate modulo bias
  const maxValidByte = 248;
  while (result.length < length) {
    const bytes = crypto.randomBytes(length * 2);
    for (let i = 0; i < bytes.length && result.length < length; i++) {
      const b = bytes[i];
      if (b < maxValidByte) {
        result.push(BASE62_ALPHABET[b % 62]);
      }
    }
  }
  return result.join("");
}

/**
 * Hashes a password using Node's built-in scrypt KDF with a 16-byte random salt.
 * Format: scrypt:<saltHex>:<derivedKeyHex>
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
  });
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

/**
 * Verifies a plaintext password against a stored scrypt hash using timing-safe comparison.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex || expectedHex.length !== 128) {
    return false;
  }
  try {
    const expectedBuf = Buffer.from(expectedHex, "hex");
    const derivedBuf = crypto.scryptSync(password, salt, 64, {
      N: 16384,
      r: 8,
      p: 1,
    });
    if (expectedBuf.length !== derivedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, derivedBuf);
  } catch {
    return false;
  }
}

export function signPayload<T extends object>(
  payload: T,
  secret: string
): string {
  const data = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64url");
  return `${data}.${sig}`;
}

export function verifySignedPayload<T>(
  token: string,
  secret: string
): T | null {
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0) return null;
  const data = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!data || !sig) return null;

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64url");

  const sigBuf = Buffer.from(sig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expectedBuf.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const json = Buffer.from(data, "base64url").toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
