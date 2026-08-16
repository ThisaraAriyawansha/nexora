"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useShopName } from "@/hooks/useShopName";
import { PermissionKey } from "@/lib/permissions";
import {
  LayoutDashboard, Package, Layers, BookMarked,
  ShoppingCart, Receipt, Shield, Settings, LogOut, X,
  Users, FileText, Wrench, PackagePlus, ArrowLeftRight, PackageMinus, History,
  Truck, ShieldCheck, Wallet, Banknote,
} from "lucide-react";

const nav: { label: string; href: string; icon: React.ElementType; permKey?: PermissionKey }[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permKey: "dashboard.view" },
  { label: "POS / New Sale", href: "/sales", icon: ShoppingCart, permKey: "sales.view" },
  { label: "Bills", href: "/bills", icon: Receipt, permKey: "bills.view" },
  { label: "Quotations", href: "/quotations", icon: FileText, permKey: "quotations.view" },
  { label: "Jobs", href: "/jobs", icon: Wrench, permKey: "jobs.view" },
  { label: "Products", href: "/products", icon: Package, permKey: "products.view" },
  { label: "GRN", href: "/grn", icon: PackagePlus, permKey: "grn.view" },
  { label: "Stock Transfer", href: "/stock-transfer", icon: ArrowLeftRight, permKey: "stockTransfer.view" },
  { label: "Stock Out", href: "/stock-out", icon: PackageMinus, permKey: "stockOut.view" },
  { label: "Stock Movements", href: "/stock-movements", icon: History, permKey: "stockMovements.view" },
  { label: "Suppliers", href: "/suppliers", icon: Truck, permKey: "suppliers.view" },
  { label: "Finance", href: "/finance", icon: Wallet, permKey: "finance.view" },
  { label: "Salary", href: "/salary", icon: Banknote, permKey: "salary.view" },
  { label: "Brands", href: "/brands", icon: BookMarked, permKey: "brands.view" },
  { label: "Categories", href: "/categories", icon: Layers, permKey: "categories.view" },
  { label: "Customers", href: "/customers", icon: Users, permKey: "customers.view" },
  { label: "Warranty", href: "/warranty", icon: Shield, permKey: "warranty.view" },
  { label: "Audit Log", href: "/audit-log", icon: ShieldCheck, permKey: "auditLog.view" },
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
  const { user, userRole, logout, can } = useAuth();
  const shopName = useShopName();

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
        <div className="px-6 py-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex-1 flex justify-center">
            <Image
              src="/shop_logo/login_page.png"
              alt="T&N COMPUTERS"
              width={200}
              height={80}
              className="h-16 w-auto object-contain"
              priority
            />
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto sidebar-nav-scroll">
          {nav.filter((item) => !item.permKey || can(item.permKey)).map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded text-sm font-poppins transition-colors ${
                  active
                    ? "bg-white text-ink font-medium"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon size={15} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-3 pb-4 border-t border-white/10 pt-4">
          <Link
            href="/profile"
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2 rounded mb-1 transition-colors group ${
              pathname === "/profile" ? "bg-white/10" : "hover:bg-white/10"
            }`}
          >
            <div className="w-7 h-7 rounded-full bg-white/15 group-hover:bg-white/25 flex items-center justify-center shrink-0 transition-colors">
              <span className="text-white text-xs font-prata">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-medium truncate">
                {user?.displayName || user?.email}
              </p>
              <p className="text-white/60 text-xs">{userRole ?? "Admin"} · View profile</p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors font-poppins"
          >
            <LogOut size={15} />
            Sign out
          </button>

          <div className="text-white/40 text-[10px] font-poppins text-center mt-3 space-y-0.5">
            <p>© {year} {shopName}</p>
            <p className="text-white/50">Design &amp; Developed by plexCode</p>
          </div>
        </div>
      </aside>
    </>
  );
}
