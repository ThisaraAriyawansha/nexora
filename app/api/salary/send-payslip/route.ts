import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { sendMail, isValidEmail } from "@/lib/mailer";
import { salaryPayslipTemplate } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  monthly: "Monthly",
  commission: "Commission",
  hybrid: "Hybrid",
};

export async function POST(req: NextRequest) {
  try {
    const { idToken, salaryPaymentId } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    if (!salaryPaymentId || typeof salaryPaymentId !== "string") {
      return NextResponse.json({ error: "Missing salary payment details." }, { status: 400 });
    }

    await getAdminAuth().verifyIdToken(idToken);

    // Re-fetch the authoritative salaryPayments doc and the recipient's real
    // email server-side — never trust client-supplied amount/employee data,
    // otherwise any authenticated account could get the shop's mailer to
    // send a fabricated payslip to an arbitrary address.
    const salarySnap = await getAdminDb().collection("salaryPayments").doc(salaryPaymentId).get();
    if (!salarySnap.exists) {
      return NextResponse.json({ error: "Salary payment not found." }, { status: 404 });
    }
    const payment = salarySnap.data()!;

    const userSnap = await getAdminDb().collection("users").doc(payment.userId).get();
    const employeeEmail = userSnap.exists ? userSnap.data()?.email : null;
    if (!isValidEmail(employeeEmail)) {
      return NextResponse.json({ error: "This employee has no valid email on file." }, { status: 400 });
    }

    const shopSnap = await getAdminDb().collection("shopSettings").doc("main").get();
    const shopData = shopSnap.exists ? shopSnap.data() : null;
    const shop = {
      name: shopData?.name || "T&N COMPUTERS",
      phone: shopData?.phone || undefined,
      email: shopData?.email || undefined,
    };

    await sendMail(
      employeeEmail,
      `Salary Payment ${payment.paymentNo} - ${shop.name}`,
      salaryPayslipTemplate({
        employeeName: payment.userName,
        paymentNo: payment.paymentNo,
        type: payment.type,
        typeLabel: TYPE_LABEL[payment.type] || payment.type,
        amount: payment.amount,
        commissionBase: payment.commissionBase ?? null,
        commissionPercent: payment.commissionPercent ?? null,
        commissionItems: payment.commissionItems ?? [],
        periodLabel: payment.periodLabel,
        note: payment.note,
        shop,
      })
    );

    await getAdminDb().collection("salaryPayments").doc(salaryPaymentId).update({
      emailSentAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("salary send-payslip error:", err);
    if (err?.code === "auth/id-token-expired" || err?.code === "auth/argument-error") {
      return NextResponse.json({ error: "Your session expired. Please sign in again." }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to send email. Please try again." }, { status: 500 });
  }
}
