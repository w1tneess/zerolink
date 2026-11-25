import { NextResponse } from "next/server";
import { issuePowChallenge } from "@/lib/pow";

export async function GET() {
  const challenge = issuePowChallenge();
  return NextResponse.json(challenge, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
