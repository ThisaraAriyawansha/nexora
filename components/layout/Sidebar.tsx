"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Package, Layers, BookMarked,
  ShoppingCart, Receipt, Shield, Settings, LogOut, X,
  Users,
} from "lucide-react";

const nav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "POS / New Sale", href: "/sales", icon: ShoppingCart },
  { label: "Bills", href: "/bills", icon: Receipt },
  { label: "Products", href: "/products", icon: Package },
  { label: "Brands", href: "/brands", icon: BookMarked },
  { label: "Categories", href: "/categories", icon: Layers },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Warranty", href: "/warranty", icon: Shield },
  { label: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar({
  open = false,
  onClose,
}: {
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

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
          <div>
            <span className="font-milonga text-white text-xl tracking-tight">Nexora</span>
            <p className="text-zinc-500 text-xs mt-0.5 font-poppins">POS System</p>
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
          <div className="px-3 mb-2">
            <p className="text-white text-xs font-medium truncate">{user?.email}</p>
            <p className="text-zinc-500 text-xs">Admin</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors font-poppins"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
