"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
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

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex w-1/2 bg-black flex-col justify-between p-12">
        <span className="font-milonga text-white text-3xl tracking-tight">Nexora</span>
        <div>
          <p className="font-prata text-white text-4xl leading-tight mb-4">
            Point of Sale<br />for Computer &<br />Accessories
          </p>
          <p className="text-zinc-400 text-sm font-poppins">
            Inventory · Sales · Warranty · Reports
          </p>
        </div>
        <p className="text-zinc-600 text-xs font-poppins">© 2024 Nexora POS</p>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex flex-col justify-center px-8 py-12 lg:px-16">
        <div className="max-w-sm w-full mx-auto">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10">
            <span className="font-milonga text-black text-2xl">Nexora</span>
          </div>

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
              <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="nexora-input"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="nexora-btn nexora-btn-primary w-full justify-center mt-2"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
