"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Package, Layers, BookMarked,
  ShoppingCart, Receipt, Shield, Settings, LogOut, X,
  Users, FileText, Wrench, PackagePlus, ArrowLeftRight, PackageMinus, History,
} from "lucide-react";

const nav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "POS / New Sale", href: "/sales", icon: ShoppingCart },
  { label: "Bills", href: "/bills", icon: Receipt },
  { label: "Quotations", href: "/quotations", icon: FileText },
  { label: "Jobs", href: "/jobs", icon: Wrench },
  { label: "Products", href: "/products", icon: Package },
  { label: "GRN", href: "/grn", icon: PackagePlus },
  { label: "Stock Transfer", href: "/stock-transfer", icon: ArrowLeftRight },
  { label: "Stock Out", href: "/stock-out", icon: PackageMinus },
  { label: "Stock Movements", href: "/stock-movements", icon: History },
  { label: "Brands", href: "/brands", icon: BookMarked },
  { label: "Categories", href: "/categories", icon: Layers },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Warranty", href: "/warranty", icon: Shield },
  { label: "Settings", href: "/settings", icon: Settings },
];

function getInitials(displayName: string | null | undefined, email: string | null | undefined): string {
  if (displayName && displayName.trim()) {
    const parts = displayName.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0][0].toUpperCase();
  }
  return email ? email[0].toUpperCase() : "U";
}

export default function Sidebar({
  open = false,
  onClose,
}: {
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, userRole, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  const initials = getInitials(user?.displayName, user?.email);
  const year = new Date().getFullYear();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 min-h-screen bg-black flex flex-col transform transition-transform duration-200 lg:static lg:translate-x-0 lg:w-56 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="px-6 py-6 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex-1 flex justify-center">
            <Image
              src="/logo/83278238723.png"
              alt="Nexora"
              width={200}
              height={80}
              className="h-16 w-auto object-contain"
              priority
            />
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded text-sm font-poppins transition-colors ${
                  active
                    ? "bg-white text-black font-medium"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                <Icon size={15} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-3 pb-4 border-t border-zinc-800 pt-4">
          <Link
            href="/profile"
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2 rounded mb-1 transition-colors group ${
              pathname === "/profile" ? "bg-zinc-800" : "hover:bg-zinc-800"
            }`}
          >
            <div className="w-7 h-7 rounded-full bg-zinc-700 group-hover:bg-zinc-600 flex items-center justify-center shrink-0 transition-colors">
              <span className="text-white text-xs font-prata">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-medium truncate">
                {user?.displayName || user?.email}
              </p>
              <p className="text-zinc-500 text-xs">{userRole ?? "Admin"} · View profile</p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors font-poppins"
          >
            <LogOut size={15} />
            Sign out
          </button>

          <div className="text-zinc-600 text-[10px] font-poppins text-center mt-3 space-y-0.5">
            <p>© {year} Nexora POS</p>
            <p className="text-zinc-700">Design &amp; Developed by plexCode</p>
          </div>
        </div>
      </aside>
    </>
  );
}
