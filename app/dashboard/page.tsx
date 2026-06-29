"use client";
import { useEffect, useState } from "react";
import { getSales, getProducts, getCustomers } from "@/lib/firestore";
import { TrendingUp, Package, Users, ShoppingBag, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const [stats, setStats] = useState({ sales: 0, revenue: 0, products: 0, customers: 0, lowStock: 0 });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [sales, products, customers] = await Promise.all([
        getSales(), getProducts(), getCustomers(),
      ]);
      const todayRevenue = sales
        .filter((s: any) => {
          const d = s.createdAt?.toDate?.();
          return d && d.toDateString() === new Date().toDateString();
        })
        .reduce((sum: number, s: any) => sum + (s.totalAmount || 0), 0);
      const lowStock = products.filter((p: any) => p.totalStock <= p.lowStockAlert).length;
      setStats({
        sales: sales.length,
        revenue: todayRevenue,
        products: products.length,
        customers: customers.length,
        lowStock,
      });
      setRecentSales(sales.slice(0, 6));
      setLoading(false);
    }
    load();
  }, []);

  const statCards = [
    { label: "Today's Revenue", value: `Rs. ${stats.revenue.toLocaleString()}`, icon: TrendingUp, sub: "Total sales today" },
    { label: "Total Sales", value: stats.sales, icon: ShoppingBag, sub: "All time" },
    { label: "Products", value: stats.products, icon: Package, sub: "In inventory" },
    { label: "Customers", value: stats.customers, icon: Users, sub: "Registered" },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-prata text-2xl text-black">Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-1">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Low stock alert */}
      {stats.lowStock > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6">
          <AlertTriangle size={15} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700">
            <span className="font-medium">{stats.lowStock} product{stats.lowStock > 1 ? "s" : ""}</span> running low on stock.{" "}
            <Link href="/products" className="underline">View products</Link>
          </p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="nexora-card p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">{card.label}</p>
                <Icon size={14} className="text-zinc-400" />
              </div>
              <p className="font-prata text-2xl text-black">{card.value}</p>
              <p className="text-xs text-zinc-400 mt-1">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Recent sales */}
      <div className="nexora-card">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="font-prata text-base text-black">Recent Sales</h2>
          <Link href="/bills" className="text-xs text-zinc-500 hover:text-black transition-colors">
            View all →
          </Link>
        </div>
        <div className="divide-y divide-zinc-50">
          {loading ? (
            <div className="px-6 py-8 text-center text-sm text-zinc-400">Loading…</div>
          ) : recentSales.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-zinc-400">No sales yet</div>
          ) : (
            recentSales.map((sale: any) => (
              <div key={sale.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-zinc-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-black">{sale.invoiceNo}</p>
                  <p className="text-xs text-zinc-400">{sale.customerName || "Walk-in customer"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-black">Rs. {sale.totalAmount?.toLocaleString()}</p>
                  <span className={`badge ${sale.paymentStatus === "paid" ? "badge-success" : "badge-warning"}`}>
                    {sale.paymentStatus}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        <Link href="/sales" className="nexora-card p-4 hover:border-black transition-colors flex items-center gap-3 group">
          <ShoppingBag size={16} className="text-zinc-400 group-hover:text-black transition-colors" />
          <span className="text-sm font-medium text-zinc-700 group-hover:text-black transition-colors">New Sale</span>
        </Link>
        <Link href="/products" className="nexora-card p-4 hover:border-black transition-colors flex items-center gap-3 group">
          <Package size={16} className="text-zinc-400 group-hover:text-black transition-colors" />
          <span className="text-sm font-medium text-zinc-700 group-hover:text-black transition-colors">Add Product</span>
        </Link>
        <Link href="/warranty" className="nexora-card p-4 hover:border-black transition-colors flex items-center gap-3 group">
          <Users size={16} className="text-zinc-400 group-hover:text-black transition-colors" />
          <span className="text-sm font-medium text-zinc-700 group-hover:text-black transition-colors">Warranties</span>
        </Link>
      </div>
    </div>
  );
}
