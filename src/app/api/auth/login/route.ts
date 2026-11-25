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
        error: `Too many sign-in attempts. Please wait ${rate.retryAfterSeconds}s and try again.`,
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
    return NextResponse.json(
      { error: "Something looked off in that request. Please try again." },
      { status: 400 }
    );
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please enter your password." },
      { status: 400 }
    );
  }

  const check = verifyAdminPassword(parsed.data.password);
  if (!check.configured) {
    return NextResponse.json(
      {
        error: "Owner sign-in isn't set up on this server yet.",
      },
      { status: 503 }
    );
  }

  if (!check.ok) {
    return NextResponse.json(
      { error: "Incorrect password. Please try again." },
      { status: 401 }
    );
  }

  let token: string;
  try {
    token = createAdminSessionToken();
  } catch {
    return NextResponse.json(
      {
        error: "Owner session settings aren't configured on this server yet.",
      },
      { status: 503 }
    );
  }
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
