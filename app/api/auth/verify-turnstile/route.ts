import { NextRequest, NextResponse } from "next/server";
import { verifyTurnstileToken } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { turnstileToken } = await req.json();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const humanVerified = await verifyTurnstileToken(turnstileToken, ip);
  if (!humanVerified) {
    return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
