import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { verifyTurnstileToken } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { email, otp, newPassword, turnstileToken } = await req.json();

    if (typeof email !== "string" || typeof otp !== "string" || typeof newPassword !== "string") {
      return NextResponse.json({ error: "Missing or invalid fields." }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "New password must be at least 6 characters." }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const humanVerified = await verifyTurnstileToken(turnstileToken, ip);
    if (!humanVerified) {
      return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 400 });
    }

    const MAX_ATTEMPTS = 5;
    const otpRef = getAdminDb().collection("passwordResetOtps").doc(email.toLowerCase());
    const snap = await otpRef.get();
    const data = snap.data();

    if (!data || data.used) {
      return NextResponse.json({ error: "Invalid or expired code." }, { status: 400 });
    }
    if (Date.now() > data.expiresAt) {
      return NextResponse.json({ error: "This code has expired. Request a new one." }, { status: 400 });
    }
    if ((data.attempts ?? 0) >= MAX_ATTEMPTS) {
      await otpRef.set({ used: true }, { merge: true });
      return NextResponse.json({ error: "Too many attempts. Please request a new code." }, { status: 429 });
    }
    if (data.otp !== otp) {
      await otpRef.set({ attempts: (data.attempts ?? 0) + 1 }, { merge: true });
      return NextResponse.json({ error: "Invalid or expired code." }, { status: 400 });
    }

    await getAdminAuth().updateUser(data.uid, { password: newPassword });
    await otpRef.set({ used: true }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("reset-password error:", err);
    return NextResponse.json({ error: "Failed to reset password. Please try again." }, { status: 500 });
  }
}
