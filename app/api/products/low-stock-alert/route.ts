import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { sendMail } from "@/lib/mailer";
import { lowStockAlertTemplate } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { idToken, items } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No low-stock items to report." }, { status: 400 });
    }

    await getAdminAuth().verifyIdToken(idToken);

    const shopSnap = await getAdminDb().collection("shopSettings").doc("main").get();
    const shopData = shopSnap.exists ? shopSnap.data() : null;
    const notifyEmails: string[] = Array.isArray(shopData?.notifyEmails) ? shopData!.notifyEmails : [];

    // No admin has configured a recipient yet — nothing to send, not an error.
    if (notifyEmails.length === 0) {
      return NextResponse.json({ success: true, skipped: true });
    }

    const shop = {
      name: shopData?.name || "Nexora",
      phone: shopData?.phone || undefined,
      email: shopData?.email || undefined,
    };

    await sendMail(
      notifyEmails.join(","),
      `Low stock alert - ${shop.name}`,
      lowStockAlertTemplate({ items, shop })
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("low-stock-alert error:", err);
    if (err?.code === "auth/id-token-expired" || err?.code === "auth/argument-error") {
      return NextResponse.json({ error: "Your session expired. Please sign in again." }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to send low-stock alert." }, { status: 500 });
  }
}
