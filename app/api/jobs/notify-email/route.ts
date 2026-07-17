import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { sendMail } from "@/lib/mailer";
import { jobUpdateTemplate } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { idToken, customerEmail, customerName, jobNo, statusLabel, device, note, repairCost, isNew } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    if (typeof customerEmail !== "string" || !customerEmail.includes("@")) {
      return NextResponse.json({ error: "Customer has no valid email on file." }, { status: 400 });
    }
    if (!jobNo || !statusLabel) {
      return NextResponse.json({ error: "Missing job details." }, { status: 400 });
    }

    await getAdminAuth().verifyIdToken(idToken);

    const shopSnap = await getAdminDb().collection("shopSettings").doc("main").get();
    const shopData = shopSnap.exists ? shopSnap.data() : null;
    const shop = {
      name: shopData?.name || "Nexora",
      phone: shopData?.phone || undefined,
      email: shopData?.email || undefined,
    };

    const subject = isNew ? `We've received your job ${jobNo} - ${shop.name}` : `Update on your job ${jobNo} - ${shop.name}`;
    await sendMail(
      customerEmail,
      subject,
      jobUpdateTemplate({
        customerName: customerName || "there",
        jobNo,
        statusLabel,
        device,
        note,
        repairCost: repairCost ?? null,
        isNew: !!isNew,
        shop,
      })
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("job notify-email error:", err);
    if (err?.code === "auth/id-token-expired" || err?.code === "auth/argument-error") {
      return NextResponse.json({ error: "Your session expired. Please sign in again." }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to send email. Please try again." }, { status: 500 });
  }
}
