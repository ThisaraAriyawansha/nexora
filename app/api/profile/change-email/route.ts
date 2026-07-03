import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { sendMail } from "@/lib/mailer";
import { changeEmailTemplate } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { idToken, newEmail } = await req.json();

    if (!idToken || typeof newEmail !== "string" || !newEmail.includes("@")) {
      return NextResponse.json({ error: "Missing or invalid fields." }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(idToken);
    const currentEmail = decoded.email;
    if (!currentEmail) {
      return NextResponse.json({ error: "Current account has no email on file." }, { status: 400 });
    }

    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      return NextResponse.json({ error: "New email is the same as your current email." }, { status: 400 });
    }

    try {
      await adminAuth.getUserByEmail(newEmail);
      return NextResponse.json({ error: "That email is already in use by another account." }, { status: 409 });
    } catch (err: any) {
      if (err?.code !== "auth/user-not-found") throw err;
    }

    const actionCodeSettings = {
      url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/login`,
      handleCodeInApp: false,
    };

    const link = await adminAuth.generateVerifyAndChangeEmailLink(currentEmail, newEmail, actionCodeSettings);

    await sendMail(
      newEmail,
      "Confirm your new email - Nexora POS",
      changeEmailTemplate(newEmail, link, currentEmail)
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("change-email error:", err);
    if (err?.code === "auth/id-token-expired" || err?.code === "auth/argument-error") {
      return NextResponse.json({ error: "Your session expired. Please sign in again." }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to send verification email. Please try again." }, { status: 500 });
  }
}
