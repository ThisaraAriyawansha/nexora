"use client";
import { useEffect, useState } from "react";
import { getSales, getProducts, getCustomers, getAllSaleItems, getMainCategories } from "@/lib/firestore";
import { TrendingUp, Package, Users, ShoppingBag, AlertTriangle, Wallet, Receipt, ArrowUp, ArrowDown, Award, Tag } from "lucide-react";
import Link from "next/link";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PAYMENT_COLORS = ["#0a0a0a", "#a1a1aa", "#e4e4e7", "#71717a"];

function delta(current: number, previous: number): { pct: number; up: boolean } | null {
  if (previous === 0) return current > 0 ? { pct: 100, up: true } : null;
  const pct = ((current - previous) / previous) * 100;
  return { pct: Math.abs(pct), up: pct >= 0 };
}

export default function DashboardPage() {
  const [stats, setStats] = useState({ sales: 0, revenue: 0, products: 0, customers: 0, lowStock: 0 });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [weekTrend, setWeekTrend] = useState<{ label: string; date: string; amount: number }[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<{ method: string; amount: number; pct: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number; revenue: number }[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<{ name: string; amount: number; pct: number }[]>([]);
  const [topCashiers, setTopCashiers] = useState<{ name: string; revenue: number; count: number }[]>([]);
  const [lowStockList, setLowStockList] = useState<{ id: string; name: string; totalStock: number; lowStockAlert: number }[]>([]);
  const [revenueDelta, setRevenueDelta] = useState<{ pct: number; up: boolean } | null>(null);
  const [profitDelta, setProfitDelta] = useState<{ pct: number; up: boolean } | null>(null);
  const [todayProfit, setTodayProfit] = useState(0);
  const [avgOrderValue, setAvgOrderValue] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [allSales, products, customers, allSaleItems, mainCats] = await Promise.all([
        getSales(), getProducts(), getCustomers(), getAllSaleItems(), getMainCategories(),
      ]);

      // Reversed bills shouldn't count toward revenue, trends, or product performance.
      const cancelledIds = new Set(allSales.filter((s: any) => s.status === "cancelled").map((s: any) => s.id));
      const sales = allSales.filter((s: any) => s.status !== "cancelled");
      const saleItems = allSaleItems.filter((it: any) => !cancelledIds.has(it.saleId));

      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const revenueOn = (d: Date) => sales
        .filter((s: any) => {
          const sd = s.createdAt?.toDate?.();
          return sd && sd.toDateString() === d.toDateString();
        })
        .reduce((sum: number, s: any) => sum + (s.totalAmount || 0), 0);
      const todayRevenue = revenueOn(today);
      const yesterdayRevenue = revenueOn(yesterday);
      setRevenueDelta(delta(todayRevenue, yesterdayRevenue));

      // Gross profit = line revenue minus the cost basis createSale recorded per item.
      const saleDateById = new Map<string, Date | undefined>(
        sales.map((s: any) => [s.id, s.createdAt?.toDate?.()])
      );
      const profitOn = (d: Date) => saleItems
        .filter((it: any) => saleDateById.get(it.saleId)?.toDateString() === d.toDateString())
        .reduce((sum: number, it: any) => sum + ((it.lineTotal || 0) - (it.costPrice || 0) * (it.qty || 0)), 0);
      const todayProfitAmount = profitOn(today);
      setTodayProfit(todayProfitAmount);
      setProfitDelta(delta(todayProfitAmount, profitOn(yesterday)));

      const allTimeRevenue = sales.reduce((sum: number, s: any) => sum + (s.totalAmount || 0), 0);
      setAvgOrderValue(sales.length > 0 ? allTimeRevenue / sales.length : 0);

      const lowStock = products.filter((p: any) => p.totalStock <= p.lowStockAlert).length;
      setStats({
        sales: sales.length,
        revenue: todayRevenue,
        products: products.length,
        customers: customers.length,
        lowStock,
      });
      setRecentSales(sales.slice(0, 6));
      setLowStockList(
        (products as any[])
          .filter((p) => p.totalStock <= p.lowStockAlert)
          .sort((a, b) => a.totalStock - b.totalStock)
          .slice(0, 5)
      );

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

      // Sales by category
      const productCategoryMap = new Map((products as any[]).map((p) => [p.id, p.mainCategoryId]));
      const categoryNameMap = new Map((mainCats as any[]).map((c) => [c.id, c.name]));
      const byCategory = new Map<string, number>();
      for (const item of saleItems as any[]) {
        const catId = productCategoryMap.get(item.productId);
        const catName = (catId && categoryNameMap.get(catId)) || "Uncategorized";
        byCategory.set(catName, (byCategory.get(catName) || 0) + (item.lineTotal || 0));
      }
      const totalCatRevenue = Array.from(byCategory.values()).reduce((a, b) => a + b, 0);
      setCategoryBreakdown(
        Array.from(byCategory.entries())
          .map(([name, amount]) => ({ name, amount, pct: totalCatRevenue > 0 ? (amount / totalCatRevenue) * 100 : 0 }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5)
      );

      // Staff performance
      const byCashier = new Map<string, { name: string; revenue: number; count: number }>();
      for (const s of sales as any[]) {
        const name = s.cashierName || "Unknown";
        const entry = byCashier.get(name) || { name, revenue: 0, count: 0 };
        entry.revenue += s.totalAmount || 0;
        entry.count += 1;
        byCashier.set(name, entry);
      }
      setTopCashiers(Array.from(byCashier.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5));

      setLoading(false);
    }
    load();
  }, []);

  const statCards = [
    { label: "Today's Revenue", value: `Rs. ${stats.revenue.toLocaleString()}`, icon: TrendingUp, sub: "Total sales today", delta: revenueDelta },
    { label: "Today's Profit", value: `Rs. ${todayProfit.toLocaleString()}`, icon: Wallet, sub: "Revenue minus cost", delta: profitDelta },
    { label: "Avg Order Value", value: `Rs. ${Math.round(avgOrderValue).toLocaleString()}`, icon: Receipt, sub: "Per sale, all time" },
    { label: "Total Sales", value: stats.sales, icon: ShoppingBag, sub: "All time" },
    { label: "Products", value: stats.products, icon: Package, sub: "In inventory" },
    { label: "Customers", value: stats.customers, icon: Users, sub: "Registered" },
  ] as { label: string; value: string | number; icon: any; sub: string; delta?: { pct: number; up: boolean } | null }[];

  const maxDay = Math.max(1, ...weekTrend.map((d) => d.amount));
  const maxProductRevenue = Math.max(1, ...topProducts.map((p) => p.revenue));
  const maxCashierRevenue = Math.max(1, ...topCashiers.map((c) => c.revenue));

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
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="nexora-card p-4 sm:p-5 min-w-0">
              <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
                <p className="text-[11px] sm:text-xs text-zinc-500 uppercase tracking-wider">{card.label}</p>
                <Icon size={14} className="text-zinc-400 shrink-0" />
              </div>
              <p className="font-prata text-lg sm:text-2xl text-black truncate">{card.value}</p>
              {card.delta ? (
                <p className={`inline-flex items-center gap-0.5 text-xs mt-1 ${card.delta.up ? "text-emerald-600" : "text-red-500"}`}>
                  {card.delta.up ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                  {card.delta.pct.toFixed(0)}% vs yesterday
                </p>
              ) : (
                <p className="text-xs text-zinc-400 mt-1">{card.sub}</p>
              )}
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
            <div className="flex items-center gap-5">
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  {(() => {
                    let cumulative = 0;
                    return paymentBreakdown.map((p, i) => {
                      const dash = `${p.pct} ${100 - p.pct}`;
                      const offset = -cumulative;
                      cumulative += p.pct;
                      return (
                        <circle
                          key={p.method}
                          cx="18" cy="18" r="15.9155"
                          fill="none"
                          stroke={PAYMENT_COLORS[i % PAYMENT_COLORS.length]}
                          strokeWidth="4"
                          strokeDasharray={dash}
                          strokeDashoffset={offset}
                          pathLength={100}
                        />
                      );
                    });
                  })()}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center px-2">
                  <p className="font-prata text-[11px] sm:text-xs text-black leading-none whitespace-nowrap">
                    Rs. {(paymentBreakdown.reduce((s, p) => s + p.amount, 0) / 1000).toFixed(0)}K
                  </p>
                  <p className="text-[8px] text-zinc-400 uppercase tracking-wider mt-1">Total</p>
                </div>
              </div>
              <div className="flex-1 space-y-2.5 min-w-0">
                {paymentBreakdown.map((p, i) => (
                  <div key={p.method} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PAYMENT_COLORS[i % PAYMENT_COLORS.length] }} />
                      <span className="text-sm text-zinc-700 capitalize truncate">{p.method}</span>
                    </div>
                    <span className="text-xs text-zinc-400 shrink-0">{p.pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Analytics: category breakdown + staff performance + low stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Sales by category */}
        <div className="nexora-card p-4 sm:p-5 min-w-0">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-5 flex items-center gap-1.5">
            <Tag size={12} /> Sales by Category
          </p>
          {loading ? (
            <p className="text-sm text-zinc-400 text-center py-10">Loading…</p>
          ) : categoryBreakdown.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-10">No sales yet</p>
          ) : (
            <div className="space-y-4">
              {categoryBreakdown.map((c) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <span className="text-sm text-zinc-700 truncate">{c.name}</span>
                    <span className="text-xs text-zinc-400 shrink-0">{c.pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                    <div className="h-full bg-black rounded-full" style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Staff performance */}
        <div className="nexora-card p-4 sm:p-5 min-w-0">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-5 flex items-center gap-1.5">
            <Award size={12} /> Staff Performance
          </p>
          {loading ? (
            <p className="text-sm text-zinc-400 text-center py-10">Loading…</p>
          ) : topCashiers.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-10">No sales yet</p>
          ) : (
            <div className="space-y-4">
              {topCashiers.map((c) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <span className="text-sm text-zinc-700 truncate">{c.name}</span>
                    <span className="text-xs text-zinc-400 shrink-0">{c.count} sale{c.count === 1 ? "" : "s"}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                    <div className="h-full bg-black rounded-full" style={{ width: `${(c.revenue / maxCashierRevenue) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low stock */}
        <div className="nexora-card p-4 sm:p-5 min-w-0">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-5 flex items-center gap-1.5">
            <AlertTriangle size={12} /> Low Stock
          </p>
          {loading ? (
            <p className="text-sm text-zinc-400 text-center py-10">Loading…</p>
          ) : lowStockList.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-10">All stocked up</p>
          ) : (
            <div className="space-y-3">
              {lowStockList.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-zinc-700 truncate">{p.name}</span>
                  <span className={`badge shrink-0 ${p.totalStock === 0 ? "badge-danger" : "badge-warning"}`}>
                    {p.totalStock} left
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top products */}
      <div className="nexora-card mb-4">
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
              <div key={p.name + i} className="px-3 sm:px-6 py-1.5 flex items-center gap-2 sm:gap-4">
                <span className="text-xs text-zinc-400 w-4 shrink-0">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-black truncate leading-tight">{p.name}</p>
                  <div className="h-1 rounded-full bg-zinc-100 overflow-hidden mt-1 max-w-full sm:max-w-[220px]">
                    <div className="h-full bg-black rounded-full" style={{ width: `${(p.revenue / maxProductRevenue) * 100}%` }} />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium text-black leading-tight">Rs. {p.revenue.toLocaleString()}</p>
                  <p className="text-xs text-zinc-400 leading-tight">{p.qty} sold</p>
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
              <div key={sale.id} className="px-4 sm:px-6 py-1.5 flex items-center justify-between gap-3 hover:bg-zinc-50 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-black leading-tight">{sale.invoiceNo}</p>
                  <p className="text-xs text-zinc-400 leading-tight">{sale.customerName || "Walk-in customer"}</p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
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
