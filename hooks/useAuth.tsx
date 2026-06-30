"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut, User,
  updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider,
  verifyBeforeUpdateEmail,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  userRole: string | null;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      try {
        if (u) {
          const snap = await getDoc(doc(db, "users", u.uid));
          setUserRole(snap.exists() ? (snap.data().role ?? "Admin") : "Admin");
        } else {
          setUserRole(null);
        }
      } catch {
        setUserRole(u ? "Admin" : null);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

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
    await verifyBeforeUpdateEmail(auth.currentUser, newEmail);
  };

  return (
    <AuthContext.Provider value={{ user, userRole, loading, login, logout, updateDisplayName, updateUserPassword, updateUserEmail }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
