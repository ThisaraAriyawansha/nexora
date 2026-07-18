import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { sendMail } from "@/lib/mailer";
import { supplierAccountStatementTemplate } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { idToken, supplierEmail, supplierName, totalPayable, amountPaid, balance } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    if (!supplierEmail || !supplierEmail.includes("@")) {
      return NextResponse.json({ error: "This supplier has no valid email on file." }, { status: 400 });
    }

    const decoded = await getAdminAuth().verifyIdToken(idToken);

    // Firestore rules can't gate an Admin-SDK route, so the Admin+ check has
    // to happen here — this is the first email route in the app that needs
    // to be role-restricted (existing routes only verify the token, not who
    // it belongs to), since sending a supplier account statement is an
    // Admin Edit-tier action.
    const userSnap = await getAdminDb().collection("users").doc(decoded.uid).get();
    const role = userSnap.exists ? userSnap.data()?.role : null;
    if (!["Super Admin", "Admin"].includes(role)) {
      return NextResponse.json({ error: "Only Admin and Super Admin can send account statements." }, { status: 403 });
    }

    const shopSnap = await getAdminDb().collection("shopSettings").doc("main").get();
    const shopData = shopSnap.exists ? shopSnap.data() : null;
    const shop = {
      name: shopData?.name || "Nexora",
      phone: shopData?.phone || undefined,
      email: shopData?.email || undefined,
    };

    await sendMail(
      supplierEmail,
      `Account Statement - ${shop.name}`,
      supplierAccountStatementTemplate({
        supplierName: supplierName || "Supplier",
        totalPayable: totalPayable ?? 0,
        amountPaid: amountPaid ?? 0,
        balance: balance ?? 0,
        shop,
      })
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("send-account-statement error:", err);
    if (err?.code === "auth/id-token-expired" || err?.code === "auth/argument-error") {
      return NextResponse.json({ error: "Your session expired. Please sign in again." }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to send account statement." }, { status: 500 });
  }
}
