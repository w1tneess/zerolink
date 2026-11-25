import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";
import {
  createAdminSessionToken,
  getAdminCookieOptions,
  verifyAdminPassword,
} from "@/lib/auth";

const loginSchema = z.object({
  password: z.string().min(1).max(256),
});

export async function POST(request: NextRequest) {
  const ip = extractClientIp(request);
  const rate = checkRateLimit("admin_login", ip, 5, 15 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: `Too many login attempts. Please wait ${rate.retryAfterSeconds}s.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Password is required." },
      { status: 400 }
    );
  }

  const check = verifyAdminPassword(parsed.data.password);
  if (!check.configured) {
    return NextResponse.json(
      {
        error:
          "ADMIN_PASSWORD_HASH is not configured on the server. Generate one with `npm run hash-password` and add it to .env.",
      },
      { status: 503 }
    );
  }

  if (!check.ok) {
    return NextResponse.json(
      { error: "Invalid owner password." },
      { status: 401 }
    );
  }

  const token = createAdminSessionToken();
  const response = NextResponse.json(
    { ok: true },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
  response.cookies.set({
    ...getAdminCookieOptions(),
    value: token,
  });
  return response;
}
