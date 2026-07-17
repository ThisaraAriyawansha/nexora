import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { sendMail } from "@/lib/mailer";
import { billEmailTemplate } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { idToken, customerEmail, customerName, invoiceNo, items, subtotal, discountAmount, totalAmount, paymentMethod, pdfBase64 } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    if (typeof customerEmail !== "string" || !customerEmail.includes("@")) {
      return NextResponse.json({ error: "Customer has no valid email on file." }, { status: 400 });
    }
    if (!invoiceNo || !Array.isArray(items)) {
      return NextResponse.json({ error: "Missing bill details." }, { status: 400 });
    }

    await getAdminAuth().verifyIdToken(idToken);

    const shopSnap = await getAdminDb().collection("shopSettings").doc("main").get();
    const shopData = shopSnap.exists ? shopSnap.data() : null;
    const shop = {
      name: shopData?.name || "Nexora",
      phone: shopData?.phone || undefined,
      email: shopData?.email || undefined,
    };

    await sendMail(
      customerEmail,
      `Your receipt ${invoiceNo} - ${shop.name}`,
      billEmailTemplate({
        customerName: customerName || "there",
        invoiceNo,
        items,
        subtotal: subtotal || 0,
        discountAmount: discountAmount || 0,
        totalAmount: totalAmount || 0,
        paymentMethod: paymentMethod || "cash",
        shop,
      }),
      typeof pdfBase64 === "string" && pdfBase64
        ? [{ filename: `${invoiceNo}.pdf`, content: pdfBase64, encoding: "base64" }]
        : undefined
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("bill send-email error:", err);
    if (err?.code === "auth/id-token-expired" || err?.code === "auth/argument-error") {
      return NextResponse.json({ error: "Your session expired. Please sign in again." }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to send email. Please try again." }, { status: 500 });
  }
}
