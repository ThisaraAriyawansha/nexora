"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut, User,
  updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider,
} from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { hasPermission, PermissionKey } from "@/lib/permissions";

interface AuthContextType {
  user: User | null;
  userRole: string | null;
  userDisplayName: string | null;
  userPermissions: Partial<Record<PermissionKey, boolean>> | null;
  can: (key: PermissionKey) => boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  updateUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateUserEmail: (currentPassword: string, newEmail: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<Partial<Record<PermissionKey, boolean>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (u) {
        // Live-subscribed (not a one-off getDoc) so that role/permission
        // changes an Admin makes in Settings take effect immediately for
        // that staff member's already-open session, instead of requiring
        // them to log out and back in.
        unsubProfile = onSnapshot(
          doc(db, "users", u.uid),
          (snap) => {
            const data = snap.exists() ? snap.data() : null;
            // No profile doc yet (or role missing) must NOT default to a
            // privileged role — hasPermission()/getDefaultPermissions() both
            // deny-by-default for a null/unrecognized role, so this fails
            // closed instead of transiently granting Admin-tier UI.
            setUserRole(data?.role ?? null);
            setUserDisplayName(data?.displayName ?? u.displayName ?? null);
            setUserPermissions(data?.permissions ?? null);
            setLoading(false);
          },
          () => {
            // Firestore read error (offline, rules denial, etc.) — same
            // least-privilege default as a missing doc, not "Admin".
            setUserRole(null);
            setUserDisplayName(u.displayName ?? null);
            setUserPermissions(null);
            setLoading(false);
          }
        );
      } else {
        setUserRole(null);
        setUserDisplayName(null);
        setUserPermissions(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const can = (key: PermissionKey) =>
    hasPermission({ role: userRole ?? "", permissions: userPermissions ?? undefined }, key);

  const login = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const profileSnap = await getDoc(doc(db, "users", cred.user.uid));
    if (profileSnap.exists() && profileSnap.data().status === "inactive") {
      await signOut(auth);
      throw Object.assign(new Error("Account disabled"), { code: "auth/user-disabled" });
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUserRole(null);
  };

  const updateDisplayName = async (displayName: string) => {
    if (!auth.currentUser) throw new Error("Not authenticated");
    await updateProfile(auth.currentUser, { displayName });
    setUser({ ...auth.currentUser });
  };

  const updateUserPassword = async (currentPassword: string, newPassword: string) => {
    if (!auth.currentUser || !auth.currentUser.email) throw new Error("Not authenticated");
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPassword);
  };

  const updateUserEmail = async (currentPassword: string, newEmail: string) => {
    if (!auth.currentUser || !auth.currentUser.email) throw new Error("Not authenticated");
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);

    const idToken = await auth.currentUser.getIdToken();
    const res = await fetch("/api/profile/change-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, newEmail }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw Object.assign(new Error(data.error || "Failed to send verification email."), { code: "custom/change-email-failed" });
    }
  };

  return (
    <AuthContext.Provider value={{ user, userRole, userDisplayName, userPermissions, can, loading, login, logout, updateDisplayName, updateUserPassword, updateUserEmail }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
