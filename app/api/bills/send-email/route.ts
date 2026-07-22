import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { sendMail, isValidEmail } from "@/lib/mailer";
import { billEmailTemplate } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { idToken, saleId, pdfBase64 } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    if (!saleId || typeof saleId !== "string") {
      return NextResponse.json({ error: "Missing bill details." }, { status: 400 });
    }

    await getAdminAuth().verifyIdToken(idToken);

    // Pull the real sale record instead of trusting the client body for
    // customerEmail/invoiceNo/items/amounts — otherwise any authenticated
    // account could get the shop's mailer to send a fabricated "receipt" to
    // an arbitrary address.
    const db = getAdminDb();
    const saleSnap = await db.collection("sales").doc(saleId).get();
    if (!saleSnap.exists) {
      return NextResponse.json({ error: "Bill not found." }, { status: 404 });
    }
    const sale = saleSnap.data()!;

    if (!isValidEmail(sale.customerEmail)) {
      return NextResponse.json({ error: "Customer has no valid email on file." }, { status: 400 });
    }

    const itemsSnap = await db.collection("sales").doc(saleId).collection("saleItems").get();
    const items = itemsSnap.docs.map((d) => {
      const i = d.data();
      return { productName: i.productName, qty: i.qty, unitPrice: i.unitPrice, lineTotal: i.lineTotal };
    });

    const shopSnap = await db.collection("shopSettings").doc("main").get();
    const shopData = shopSnap.exists ? shopSnap.data() : null;
    const shop = {
      name: shopData?.name || "Nexora",
      phone: shopData?.phone || undefined,
      email: shopData?.email || undefined,
    };

    await sendMail(
      sale.customerEmail,
      `Your receipt ${sale.invoiceNo} - ${shop.name}`,
      billEmailTemplate({
        customerName: sale.customerName || "there",
        invoiceNo: sale.invoiceNo,
        items,
        subtotal: sale.subtotal || 0,
        discountAmount: sale.discountAmount || 0,
        totalAmount: sale.totalAmount || 0,
        paymentMethod: sale.paymentMethod || "cash",
        shop,
      }),
      typeof pdfBase64 === "string" && pdfBase64
        ? [{ filename: `${sale.invoiceNo}.pdf`, content: pdfBase64, encoding: "base64" }]
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
