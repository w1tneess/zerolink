import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getEnv, getSessionSecret } from "./env";
import { signPayload, verifyPassword, verifySignedPayload } from "./crypto";

export const ADMIN_SESSION_COOKIE = "ls_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

interface AdminSessionPayload {
  sub: "admin";
  iat: number;
  exp: number;
}

export function verifyAdminPassword(candidate: string): {
  ok: boolean;
  configured: boolean;
} {
  const env = getEnv();
  const hash = env.ADMIN_PASSWORD_HASH;
  if (!hash || !hash.trim()) {
    return { ok: false, configured: false };
  }
  return {
    ok: verifyPassword(candidate, hash.trim()),
    configured: true,
  };
}

export function createAdminSessionToken(now = Date.now()): string {
  const payload: AdminSessionPayload = {
    sub: "admin",
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  return signPayload(payload, getSessionSecret());
}

export function verifyAdminSessionToken(
  token: string | undefined | null,
  now = Date.now()
): AdminSessionPayload | null {
  if (!token) return null;
  try {
    const payload = verifySignedPayload<AdminSessionPayload>(
      token,
      getSessionSecret()
    );
    if (!payload || payload.sub !== "admin") return null;
    if (typeof payload.exp !== "number" || payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function isAdminAuthenticated(
  request?: NextRequest
): Promise<boolean> {
  if (request) {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    return verifyAdminSessionToken(token) !== null;
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return verifyAdminSessionToken(token) !== null;
}

export function getAdminCookieOptions(maxAgeSeconds = SESSION_TTL_MS / 1000) {
  const env = getEnv();
  return {
    name: ADMIN_SESSION_COOKIE,
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
