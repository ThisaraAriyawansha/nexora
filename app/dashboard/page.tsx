"use client";
import { useEffect, useState } from "react";
import { getSales, getProducts, getCustomers, getAllSaleItems } from "@/lib/firestore";
import { TrendingUp, Package, Users, ShoppingBag, AlertTriangle } from "lucide-react";
import Link from "next/link";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function DashboardPage() {
  const [stats, setStats] = useState({ sales: 0, revenue: 0, products: 0, customers: 0, lowStock: 0 });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [weekTrend, setWeekTrend] = useState<{ label: string; date: string; amount: number }[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<{ method: string; amount: number; pct: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number; revenue: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [sales, products, customers, saleItems] = await Promise.all([
        getSales(), getProducts(), getCustomers(), getAllSaleItems(),
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

      // Last 7 days revenue trend
      const days: { label: string; date: string; amount: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const amount = sales
          .filter((s: any) => {
            const sd = s.createdAt?.toDate?.();
            return sd && sd.toDateString() === d.toDateString();
          })
          .reduce((sum: number, s: any) => sum + (s.totalAmount || 0), 0);
        days.push({
          label: DAY_LABELS[d.getDay()],
          date: d.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
          amount,
        });
      }
      setWeekTrend(days);

      // Payment method breakdown
      const byMethod = new Map<string, number>();
      for (const s of sales as any[]) {
        const m = s.paymentMethod || "other";
        byMethod.set(m, (byMethod.get(m) || 0) + (s.totalAmount || 0));
      }
      const totalRevenue = Array.from(byMethod.values()).reduce((a, b) => a + b, 0);
      setPaymentBreakdown(
        Array.from(byMethod.entries())
          .map(([method, amount]) => ({ method, amount, pct: totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0 }))
          .sort((a, b) => b.amount - a.amount)
      );

      // Top products by revenue
      const byProduct = new Map<string, { name: string; qty: number; revenue: number }>();
      for (const item of saleItems as any[]) {
        const key = item.productId || item.productName;
        const entry = byProduct.get(key) || { name: item.productName, qty: 0, revenue: 0 };
        entry.qty += item.qty || 0;
        entry.revenue += item.lineTotal || 0;
        byProduct.set(key, entry);
      }
      setTopProducts(
        Array.from(byProduct.values())
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5)
      );

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

  const maxDay = Math.max(1, ...weekTrend.map((d) => d.amount));
  const maxProductRevenue = Math.max(1, ...topProducts.map((p) => p.revenue));

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-prata text-2xl text-black">Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-1">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Low stock alert */}
      {stats.lowStock > 0 && (
        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3 sm:px-4 py-3 mb-6">
          <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
          <p className="text-sm text-amber-700">
            <span className="font-medium">{stats.lowStock} product{stats.lowStock > 1 ? "s" : ""}</span> running low on stock.{" "}
            <Link href="/products" className="underline">View products</Link>
          </p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="nexora-card p-4 sm:p-5 min-w-0">
              <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
                <p className="text-[11px] sm:text-xs text-zinc-500 uppercase tracking-wider">{card.label}</p>
                <Icon size={14} className="text-zinc-400 shrink-0" />
              </div>
              <p className="font-prata text-lg sm:text-2xl text-black truncate">{card.value}</p>
              <p className="text-xs text-zinc-400 mt-1">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Analytics: weekly trend + payment breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* 7-day revenue trend */}
        <div className="lg:col-span-2 nexora-card p-4 sm:p-5 min-w-0 overflow-hidden">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-5">Last 7 Days</p>
          {loading ? (
            <p className="text-sm text-zinc-400 text-center py-10">Loading…</p>
          ) : (
            <div className="flex items-end justify-between gap-1 sm:gap-2 h-28 sm:h-36">
              {weekTrend.map((d, i) => {
                const isPeak = d.amount === maxDay && d.amount > 0;
                const heightPct = d.amount > 0 ? Math.max(4, (d.amount / maxDay) * 100) : 2;
                return (
                  <div key={i} className="group relative flex-1 flex flex-col items-center justify-end h-full min-w-0">
                    {isPeak && (
                      <p className="text-[9px] sm:text-[10px] font-medium text-black mb-1 whitespace-nowrap">
                        Rs. {d.amount.toLocaleString()}
                      </p>
                    )}
                    <div
                      className={`w-full max-w-[18px] sm:max-w-[28px] rounded-t ${d.amount > 0 ? "bg-black" : "bg-zinc-100"} transition-all`}
                      style={{ height: `${heightPct}%` }}
                    />
                    <div className="absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-black text-white text-[10px] rounded px-2 py-1 whitespace-nowrap z-10">
                      Rs. {d.amount.toLocaleString()} · {d.date}
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-zinc-400 mt-2">{d.label}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Payment method breakdown */}
        <div className="nexora-card p-4 sm:p-5 min-w-0">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-5">Payment Methods</p>
          {loading ? (
            <p className="text-sm text-zinc-400 text-center py-10">Loading…</p>
          ) : paymentBreakdown.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-10">No sales yet</p>
          ) : (
            <div className="space-y-4">
              {paymentBreakdown.map((p) => (
                <div key={p.method}>
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <span className="text-sm text-zinc-700 capitalize truncate">{p.method}</span>
                    <span className="text-xs text-zinc-400 shrink-0">{p.pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                    <div className="h-full bg-black rounded-full" style={{ width: `${p.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top products */}
      <div className="nexora-card mb-8">
        <div className="px-4 sm:px-6 py-4 border-b border-zinc-100">
          <h2 className="font-prata text-base text-black">Top Products</h2>
        </div>
        <div className="divide-y divide-zinc-50">
          {loading ? (
            <div className="px-6 py-8 text-center text-sm text-zinc-400">Loading…</div>
          ) : topProducts.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-zinc-400">No sales yet</div>
          ) : (
            topProducts.map((p, i) => (
              <div key={p.name + i} className="px-3 sm:px-6 py-3.5 flex items-center gap-2 sm:gap-4">
                <span className="text-xs text-zinc-400 w-4 shrink-0">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-black truncate">{p.name}</p>
                  <div className="h-1 rounded-full bg-zinc-100 overflow-hidden mt-1.5 max-w-full sm:max-w-[220px]">
                    <div className="h-full bg-black rounded-full" style={{ width: `${(p.revenue / maxProductRevenue) * 100}%` }} />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium text-black">Rs. {p.revenue.toLocaleString()}</p>
                  <p className="text-xs text-zinc-400">{p.qty} sold</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent sales */}
      <div className="nexora-card">
        <div className="px-4 sm:px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
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
              <div key={sale.id} className="px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 hover:bg-zinc-50 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-black">{sale.invoiceNo}</p>
                  <p className="text-xs text-zinc-400">{sale.customerName || "Walk-in customer"}</p>
                </div>
                <div className="text-right shrink-0">
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
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
