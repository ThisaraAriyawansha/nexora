import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { canManagePermissionsFor } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { idToken, targetUid } = await req.json();

    if (!idToken || !targetUid) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(idToken);

    if (decoded.uid === targetUid) {
      return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const [callerSnap, targetSnap] = await Promise.all([
      adminDb.collection("users").doc(decoded.uid).get(),
      adminDb.collection("users").doc(targetUid).get(),
    ]);
    const callerRole = callerSnap.exists ? callerSnap.data()?.role : null;
    const targetRole = targetSnap.exists ? targetSnap.data()?.role : null;

    // Firestore rules can't gate an Admin-SDK route, so this mirrors
    // firestore.rules' users/{userId} delete rule: Super Admin can delete
    // anyone; Admin can only delete the tier below (Manager/Cashier/
    // Technician/Staff), never a peer Admin or a Super Admin.
    const allowed = callerRole === "Super Admin" || canManagePermissionsFor(callerRole ?? "", targetRole ?? "");
    if (!allowed) {
      return NextResponse.json({ error: "You don't have permission to delete this user." }, { status: 403 });
    }

    try {
      await adminAuth.deleteUser(targetUid);
    } catch (err: any) {
      if (err?.code !== "auth/user-not-found") throw err;
    }
    await adminDb.collection("users").doc(targetUid).delete();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("delete-user error:", err);
    if (err?.code === "auth/id-token-expired" || err?.code === "auth/argument-error") {
      return NextResponse.json({ error: "Your session expired. Please sign in again." }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to delete user." }, { status: 500 });
  }
}
