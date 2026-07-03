import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { sendMail } from "@/lib/mailer";
import { passwordResetOtpTemplate } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

const OTP_TTL_MS = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
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

    const otp = String(Math.floor(100000 + Math.random() * 900000));

    await getAdminDb()
      .collection("passwordResetOtps")
      .doc(email.toLowerCase())
      .set({
        otp,
        uid: user.uid,
        expiresAt: Date.now() + OTP_TTL_MS,
        used: false,
        createdAt: Date.now(),
      });

    await sendMail(email, "Your password reset code - Nexora POS", passwordResetOtpTemplate(otp));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("forgot-password error:", err);
    return NextResponse.json({ error: "Failed to send reset code. Please try again." }, { status: 500 });
  }
}
