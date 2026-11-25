import { NextResponse } from "next/server";
import { getAdminCookieOptions } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json(
    { ok: true },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
  response.cookies.set({
    ...getAdminCookieOptions(0),
    value: "",
  });
  return response;
}
