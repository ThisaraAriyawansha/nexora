"use client";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import LoadingScreen from "@/components/LoadingScreen";

function HeaderClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="text-white lg:text-black text-xs font-poppins tabular-nums">
      {now
        ? `${now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" })} · ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : " "}
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
  }, [user, loading, router]);

  if (loading) {
    return <LoadingScreen />;
  }
  if (!user) return null;

  return (
    <div className="flex h-screen bg-zinc-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between gap-3 px-4 py-2 bg-black lg:bg-white lg:border-b lg:border-zinc-200 shrink-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-white lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
            <span className="font-milonga text-white text-lg lg:hidden">Nexora</span>
          </div>
          <HeaderClock />
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
