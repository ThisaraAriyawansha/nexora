"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getUserProfile, upsertUserProfile } from "@/lib/firestore";
import { UserProfile } from "@/types";
import { User, Lock, Mail, CheckCircle, AlertCircle } from "lucide-react";

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name && name.trim()) {
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0][0].toUpperCase();
  }
  return email ? email[0].toUpperCase() : "U";
}

export default function ProfilePage() {
  const { user, userRole, updateDisplayName, updateUserPassword, updateUserEmail } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileForm, setProfileForm] = useState({ displayName: "", phone: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [emailForm, setEmailForm] = useState({ current: "", newEmail: "" });
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((p) => {
      if (p) {
        setProfile(p);
        setProfileForm({
          displayName: p.displayName || user.displayName || "",
          phone: p.phone || "",
        });
      } else {
        setProfileForm({
          displayName: user.displayName || "",
          phone: "",
        });
      }
    });
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      await updateDisplayName(profileForm.displayName.trim());
      await upsertUserProfile(user.uid, {
        displayName: profileForm.displayName.trim(),
        phone: profileForm.phone.trim(),
      });
      setProfileMsg({ type: "success", text: "Profile updated successfully." });
    } catch {
      setProfileMsg({ type: "error", text: "Failed to update profile. Please try again." });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailMsg(null);
    if (!emailForm.newEmail.includes("@")) {
      setEmailMsg({ type: "error", text: "Enter a valid email address." });
      return;
    }
    if (emailForm.newEmail === user?.email) {
      setEmailMsg({ type: "error", text: "New email is the same as your current email." });
      return;
    }
    setSavingEmail(true);
    try {
      await updateUserEmail(emailForm.current, emailForm.newEmail);
      setEmailMsg({
        type: "success",
        text: `Verification email sent to ${emailForm.newEmail}. Click the link there to confirm the change.`,
      });
      setEmailForm({ current: "", newEmail: "" });
    } catch (err: any) {
      const msg =
        err?.code === "auth/wrong-password" || err?.code === "auth/invalid-credential"
          ? "Current password is incorrect."
          : err?.code === "auth/email-already-in-use"
          ? "That email is already in use by another account."
          : err?.code === "auth/too-many-requests"
          ? "Too many attempts. Please try again later."
          : "Failed to send verification email. Please try again.";
      setEmailMsg({ type: "error", text: msg });
    } finally {
      setSavingEmail(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordMsg({ type: "error", text: "New passwords do not match." });
      return;
    }
    if (passwordForm.next.length < 6) {
      setPasswordMsg({ type: "error", text: "New password must be at least 6 characters." });
      return;
    }
    setSavingPassword(true);
    try {
      await updateUserPassword(passwordForm.current, passwordForm.next);
      setPasswordMsg({ type: "success", text: "Password changed successfully." });
      setPasswordForm({ current: "", next: "", confirm: "" });
    } catch (err: any) {
      const msg =
        err?.code === "auth/wrong-password" || err?.code === "auth/invalid-credential"
          ? "Current password is incorrect."
          : err?.code === "auth/too-many-requests"
          ? "Too many attempts. Please try again later."
          : "Failed to change password. Please try again.";
      setPasswordMsg({ type: "error", text: msg });
    } finally {
      setSavingPassword(false);
    }
  };

  const initials = getInitials(profileForm.displayName || user?.displayName, user?.email);

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="font-prata text-2xl text-black">My Profile</h1>
        <p className="text-zinc-500 text-sm mt-1">Manage your account details and password</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column: Avatar + Profile Info */}
        <div className="lg:col-span-3">
          <div className="nexora-card p-4 sm:p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full bg-black flex items-center justify-center shrink-0">
                <span className="text-white font-prata text-xl">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="font-medium text-black text-base truncate">
                  {profileForm.displayName || "—"}
                </p>
                <p className="text-zinc-400 text-sm truncate">{user?.email}</p>
                <span className="inline-block mt-1 text-xs font-poppins bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded">
                  {userRole ?? profile?.role ?? "Admin"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <User size={14} className="text-zinc-400" />
              <h2 className="font-prata text-sm text-black">Profile Info</h2>
            </div>
            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Display Name</label>
                  <input
                    className="nexora-input"
                    placeholder="Your full name"
                    value={profileForm.displayName}
                    onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Phone</label>
                  <input
                    className="nexora-input"
                    placeholder="Phone number"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-zinc-500 mb-1 block">Email</label>
                  <input
                    className="nexora-input opacity-60 cursor-not-allowed"
                    value={user?.email ?? ""}
                    readOnly
                    tabIndex={-1}
                  />
                  <p className="text-xs text-zinc-400 mt-1">Email cannot be changed here.</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="nexora-btn nexora-btn-primary text-xs py-1.5 px-3"
                >
                  {savingProfile ? "Saving..." : "Save Profile"}
                </button>
                {profileMsg && (
                  <span className={`flex items-center gap-1.5 text-xs min-w-0 ${profileMsg.type === "success" ? "text-green-600" : "text-red-500"}`}>
                    {profileMsg.type === "success" ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                    {profileMsg.text}
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Right column: Change Email + Change Password */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Change email */}
          <div className="nexora-card p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-1">
              <Mail size={14} className="text-zinc-400" />
              <h2 className="font-prata text-sm text-black">Change Email</h2>
            </div>
            <p className="text-xs text-zinc-400 mb-4">
              A verification link will be sent to the new address. Your email won't change until you click it.
            </p>
            <form onSubmit={handleChangeEmail} className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">New Email</label>
                <input
                  type="email"
                  className="nexora-input"
                  placeholder="new@email.com"
                  required
                  value={emailForm.newEmail}
                  onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Current Password</label>
                <input
                  type="password"
                  className="nexora-input"
                  placeholder="To confirm it's you"
                  required
                  value={emailForm.current}
                  onChange={(e) => setEmailForm({ ...emailForm, current: e.target.value })}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={savingEmail}
                  className="nexora-btn nexora-btn-primary text-xs py-1.5 px-3"
                >
                  {savingEmail ? "Sending..." : "Send Verification"}
                </button>
                {emailMsg && (
                  <span className={`flex items-center gap-1.5 text-xs min-w-0 ${emailMsg.type === "success" ? "text-green-600" : "text-red-500"}`}>
                    {emailMsg.type === "success" ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                    {emailMsg.text}
                  </span>
                )}
              </div>
            </form>
          </div>

          {/* Change password */}
          <div className="nexora-card p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Lock size={14} className="text-zinc-400" />
              <h2 className="font-prata text-sm text-black">Change Password</h2>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Current Password</label>
                <input
                  type="password"
                  className="nexora-input"
                  placeholder="Enter current password"
                  required
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">New Password</label>
                <input
                  type="password"
                  className="nexora-input"
                  placeholder="At least 6 characters"
                  required
                  value={passwordForm.next}
                  onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Confirm New Password</label>
                <input
                  type="password"
                  className="nexora-input"
                  placeholder="Repeat new password"
                  required
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="nexora-btn nexora-btn-primary text-xs py-1.5 px-3"
                >
                  {savingPassword ? "Changing..." : "Change Password"}
                </button>
                {passwordMsg && (
                  <span className={`flex items-center gap-1.5 text-xs min-w-0 ${passwordMsg.type === "success" ? "text-green-600" : "text-red-500"}`}>
                    {passwordMsg.type === "success" ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                    {passwordMsg.text}
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
