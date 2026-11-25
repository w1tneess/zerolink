import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const authenticated = await isAdminAuthenticated(request);
  return NextResponse.json(
    { authenticated },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
