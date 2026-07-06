"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import TurnstileWidget from "@/components/ui/TurnstileWidget";

type Mode = "login" | "forgot" | "reset";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const year = new Date().getFullYear();

  const [mode, setMode] = useState<Mode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [resetEmail, setResetEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetInfo, setResetInfo] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [forgotToken, setForgotToken] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [loginToken, setLoginToken] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!loginToken) {
      setError("Please complete the verification challenge.");
      return;
    }
    setLoading(true);
    try {
      const verifyRes = await fetch("/api/auth/verify-turnstile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnstileToken: loginToken }),
      });
      if (!verifyRes.ok) {
        setError("Verification failed. Please try again.");
        setLoginToken("");
        return;
      }
      await login(email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(
        err?.code === "auth/user-disabled"
          ? "Your account has been disabled. Contact your administrator."
          : "Invalid email or password."
      );
    } finally {
      setLoading(false);
    }
  };

  const goToForgot = () => {
    setResetEmail(email);
    setResetError("");
    setResetInfo("");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setForgotToken("");
    setResetToken("");
    setMode("forgot");
  };

  const backToLogin = () => {
    setResetError("");
    setResetInfo("");
    setMode("login");
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    setResetInfo("");
    if (!forgotToken) {
      setResetError("Please complete the verification challenge.");
      return;
    }
    setResetLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail, turnstileToken: forgotToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reset code.");
      setResetInfo(`A 6-digit code was sent to ${resetEmail}.`);
      setResetToken("");
      setMode("reset");
    } catch (err: any) {
      setResetError(err.message || "Failed to send reset code.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    setResetInfo("");
    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setResetError("New password must be at least 6 characters.");
      return;
    }
    if (!resetToken) {
      setResetError("Please complete the verification challenge.");
      return;
    }
    setResetLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail, otp, newPassword, turnstileToken: resetToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password.");
      setResetInfo("Password reset. You can sign in now.");
      setEmail(resetEmail);
      setPassword("");
      setTimeout(() => setMode("login"), 1200);
    } catch (err: any) {
      setResetError(err.message || "Failed to reset password.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex w-1/2 bg-black flex-col items-center justify-center p-12 relative">
        <Image
          src="/logo/674647452.png"
          alt="Nexora"
          width={360}
          height={360}
          className="w-[85%] h-auto max-w-[360px]"
          priority
        />
        <div className="text-zinc-600 text-xs font-poppins text-center space-y-0.5 absolute bottom-12">
          <p>© {year} Nexora POS</p>
          <p className="text-zinc-700">Design &amp; Developed by plexCode</p>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex flex-col justify-center px-8 py-12 lg:px-16">
        <div className="max-w-sm w-full mx-auto">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10 flex justify-center">
            <Image
              src="/logo/5326326732673527.png"
              alt="Nexora"
              width={280}
              height={280}
              className="w-auto h-32"
              priority
            />
          </div>

          {mode === "login" && (
            <>
              <h1 className="font-prata text-2xl text-black mb-1">Sign in</h1>
              <p className="text-zinc-500 text-sm mb-8 font-poppins">Enter your credentials to continue</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wider">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="nexora-input"
                    placeholder="admin@nexora.com"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={goToForgot}
                      className="text-xs text-zinc-500 hover:text-black font-poppins"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="nexora-input"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <TurnstileWidget onVerify={setLoginToken} onExpire={() => setLoginToken("")} />

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <button
                  type="submit"
                  disabled={loading || !loginToken}
                  className="nexora-btn nexora-btn-primary w-full justify-center mt-2"
                >
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>
            </>
          )}

          {mode === "forgot" && (
            <>
              <h1 className="font-prata text-2xl text-black mb-1">Reset password</h1>
              <p className="text-zinc-500 text-sm mb-8 font-poppins">
                Enter your account email and we'll send you a 6-digit code.
              </p>

              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wider">
                    Email
                  </label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="nexora-input"
                    placeholder="admin@nexora.com"
                    required
                  />
                </div>

                <TurnstileWidget onVerify={setForgotToken} onExpire={() => setForgotToken("")} />

                {resetError && <p className="text-red-500 text-sm">{resetError}</p>}

                <button
                  type="submit"
                  disabled={resetLoading || !forgotToken}
                  className="nexora-btn nexora-btn-primary w-full justify-center mt-2"
                >
                  {resetLoading ? "Sending…" : "Send code"}
                </button>
                <button
                  type="button"
                  onClick={backToLogin}
                  className="w-full text-center text-xs text-zinc-500 hover:text-black font-poppins mt-1"
                >
                  Back to sign in
                </button>
              </form>
            </>
          )}

          {mode === "reset" && (
            <>
              <h1 className="font-prata text-2xl text-black mb-1">Enter code</h1>
              <p className="text-zinc-500 text-sm mb-8 font-poppins">
                {resetInfo || `Enter the 6-digit code sent to ${resetEmail}.`}
              </p>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wider">
                    6-digit code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    className="nexora-input tracking-[0.3em] text-center"
                    placeholder="000000"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wider">
                    New password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="nexora-input"
                    placeholder="At least 6 characters"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wider">
                    Confirm new password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="nexora-input"
                    placeholder="Repeat new password"
                    required
                  />
                </div>

                <TurnstileWidget onVerify={setResetToken} onExpire={() => setResetToken("")} />

                {resetError && <p className="text-red-500 text-sm">{resetError}</p>}
                {resetInfo && !resetError && <p className="text-green-600 text-sm">{resetInfo}</p>}

                <button
                  type="submit"
                  disabled={resetLoading || !resetToken}
                  className="nexora-btn nexora-btn-primary w-full justify-center mt-2"
                >
                  {resetLoading ? "Resetting…" : "Reset password"}
                </button>
                <button
                  type="button"
                  onClick={backToLogin}
                  className="w-full text-center text-xs text-zinc-500 hover:text-black font-poppins mt-1"
                >
                  Back to sign in
                </button>
              </form>
            </>
          )}

          {/* Mobile footer */}
          <div className="lg:hidden text-zinc-400 text-xs font-poppins text-center space-y-0.5 mt-10">
            <p>© {year} Nexora POS</p>
            <p className="text-zinc-500">Design &amp; Developed by plexCode</p>
          </div>
        </div>
      </div>
    </div>
  );
}
