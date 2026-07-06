import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { sendMail } from "@/lib/mailer";
import { passwordResetOtpTemplate } from "@/lib/email-templates";
import { verifyTurnstileToken } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const { email, turnstileToken } = await req.json();

    if (typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const humanVerified = await verifyTurnstileToken(turnstileToken, ip);
    if (!humanVerified) {
      return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    let user;
    try {
      user = await adminAuth.getUserByEmail(email);
    } catch (err: any) {
      if (err?.code === "auth/user-not-found") {
        return NextResponse.json({ error: "No account found with this email." }, { status: 404 });
      }
      throw err;
    }

    const otpRef = getAdminDb().collection("passwordResetOtps").doc(email.toLowerCase());
    const existing = (await otpRef.get()).data();
    if (existing && !existing.used && Date.now() - existing.createdAt < RESEND_COOLDOWN_MS) {
      return NextResponse.json({ error: "Please wait a moment before requesting another code." }, { status: 429 });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));

    await otpRef.set({
      otp,
      uid: user.uid,
      expiresAt: Date.now() + OTP_TTL_MS,
      used: false,
      attempts: 0,
      createdAt: Date.now(),
    });

    await sendMail(email, "Your password reset code - Nexora POS", passwordResetOtpTemplate(otp));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("forgot-password error:", err);
    return NextResponse.json({ error: "Failed to send reset code. Please try again." }, { status: 500 });
  }
}
