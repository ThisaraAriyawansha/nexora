import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { sendMail, isValidEmail } from "@/lib/mailer";
import { jobUpdateTemplate } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  ongoing: "Ongoing",
  done: "Done",
  unrepairable: "Unrepairable",
};

export async function POST(req: NextRequest) {
  try {
    const { idToken, jobId, note, isNew } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json({ error: "Missing job details." }, { status: 400 });
    }

    await getAdminAuth().verifyIdToken(idToken);

    // Pull the real job record instead of trusting the client body for
    // customerEmail/customerName/jobNo/device/repairCost/status — otherwise
    // any authenticated account could get the shop's mailer to send a
    // fabricated "job update" to an arbitrary address.
    const jobSnap = await getAdminDb().collection("jobs").doc(jobId).get();
    if (!jobSnap.exists) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    const job = jobSnap.data()!;

    if (!isValidEmail(job.customerEmail)) {
      return NextResponse.json({ error: "Customer has no valid email on file." }, { status: 400 });
    }

    const shopSnap = await getAdminDb().collection("shopSettings").doc("main").get();
    const shopData = shopSnap.exists ? shopSnap.data() : null;
    const shop = {
      name: shopData?.name || "Nexora",
      phone: shopData?.phone || undefined,
      email: shopData?.email || undefined,
    };

    const statusLabel = STATUS_LABEL[job.status] || job.status;
    const device = job.deviceType === "Other" ? job.deviceTypeOther : job.deviceType;
    const subject = isNew ? `We've received your job ${job.jobNo} - ${shop.name}` : `Update on your job ${job.jobNo} - ${shop.name}`;

    await sendMail(
      job.customerEmail,
      subject,
      jobUpdateTemplate({
        customerName: job.customerName || "there",
        jobNo: job.jobNo,
        statusLabel,
        device,
        note: typeof note === "string" ? note : "",
        repairCost: job.repairCost ?? null,
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
