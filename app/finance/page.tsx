"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getShifts, getSalesByShift, reviewShift,
  getSales, getAllSaleItems, getSuppliers, getExpenses, addExpense, deleteExpense,
} from "@/lib/firestore";
import { ExpenseCategory } from "@/types";
import { Search, Download, Wallet, X, TrendingUp, Receipt, Plus, Trash2 } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { rowsToCSV, downloadCSV } from "@/lib/csv";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

const PAGE_SIZE = 20;

const REVIEW_BADGE: Record<string, string> = {
  pending: "badge-warning",
  approved: "badge-success",
  flagged: "badge-danger",
};

const REVIEW_LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  flagged: "Flagged",
};

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "rent", label: "Rent" },
  { value: "utilities", label: "Utilities" },
  { value: "salaries", label: "Salaries" },
  { value: "maintenance", label: "Maintenance" },
  { value: "marketing", label: "Marketing" },
  { value: "other", label: "Other" },
];

const EXPENSE_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.value, c.label]));

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartStr() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

const formatDate = (ts: any) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function FinancePage() {
  const { user, userDisplayName, can } = useAuth();
  const canView = can("finance.view");
  const canReview = can("finance.reviewShift");
  const canAddExpense = can("finance.addExpense");
  const canDeleteExpense = can("finance.deleteExpense");

  const [tab, setTab] = useState<"overview" | "shifts" | "expenses">("overview");

  // ─── Overview ───────────────────────────────────────────────────────────
  const [ovFromDate, setOvFromDate] = useState(monthStartStr());
  const [ovToDate, setOvToDate] = useState(todayStr());
  const [ovLoading, setOvLoading] = useState(true);
  const [ovSales, setOvSales] = useState<any[]>([]);
  const [ovSaleItems, setOvSaleItems] = useState<any[]>([]);
  const [ovExpenses, setOvExpenses] = useState<any[]>([]);
  const [ovSuppliers, setOvSuppliers] = useState<any[]>([]);

  useEffect(() => {
    if (!canView) { setOvLoading(false); return; }
    setOvLoading(true);
    const from = ovFromDate ? new Date(`${ovFromDate}T00:00:00`) : undefined;
    const to = ovToDate ? new Date(`${ovToDate}T23:59:59.999`) : undefined;
    Promise.all([
      getSales({ fromDate: from, toDate: to }),
      getAllSaleItems(),
      getExpenses({ fromDate: from, toDate: to }),
      getSuppliers(),
    ]).then(([sales, allItems, exp, suppliers]) => {
      const activeSales = (sales as any[]).filter((s) => s.status !== "cancelled");
      const saleIds = new Set(activeSales.map((s) => s.id));
      setOvSales(activeSales);
      setOvSaleItems((allItems as any[]).filter((it) => saleIds.has(it.saleId)));
      setOvExpenses(exp as any[]);
      setOvSuppliers(suppliers as any[]);
      setOvLoading(false);
    });
  }, [canView, ovFromDate, ovToDate]);

  const revenue = ovSales.reduce((s, x) => s + (x.totalAmount || 0), 0);
  const cogs = ovSaleItems.reduce((s, it) => s + (it.costPrice || 0) * (it.qty || 0), 0);
  const grossProfit = revenue - cogs;
  const totalExpenses = ovExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const netProfit = grossProfit - totalExpenses;
  const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  const paymentBreakdown = (() => {
    const byMethod = new Map<string, number>();
    for (const s of ovSales) {
      const m = s.paymentMethod || "other";
      byMethod.set(m, (byMethod.get(m) || 0) + (s.totalAmount || 0));
    }
    const total = Array.from(byMethod.values()).reduce((a, b) => a + b, 0);
    return Array.from(byMethod.entries())
      .map(([method, amount]) => ({ method, amount, pct: total > 0 ? (amount / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount);
  })();

  const cashierBreakdown = (() => {
    const byCashier = new Map<string, { name: string; revenue: number; count: number }>();
    for (const s of ovSales) {
      const name = s.cashierName || "Unknown";
      const entry = byCashier.get(name) || { name, revenue: 0, count: 0 };
      entry.revenue += s.totalAmount || 0;
      entry.count += 1;
      byCashier.set(name, entry);
    }
    return Array.from(byCashier.values()).sort((a, b) => b.revenue - a.revenue);
  })();

  const outstandingSuppliers = ovSuppliers
    .filter((s) => (s.balance ?? 0) > 0)
    .sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));
  const totalPayables = outstandingSuppliers.reduce((s, x) => s + (x.balance || 0), 0);

  const kpiCards = [
    { label: "Revenue", value: `Rs. ${revenue.toLocaleString()}`, icon: TrendingUp },
    { label: "COGS", value: `Rs. ${cogs.toLocaleString()}`, icon: Receipt },
    { label: "Gross Profit", value: `Rs. ${grossProfit.toLocaleString()}`, icon: Wallet },
    { label: "Expenses", value: `Rs. ${totalExpenses.toLocaleString()}`, icon: Receipt },
    { label: "Net Profit", value: `Rs. ${netProfit.toLocaleString()}`, icon: Wallet },
    { label: "Margin", value: `${margin.toFixed(1)}%`, icon: TrendingUp },
  ];

  const handleExportOverview = () => {
    const rows = [{
      "Date Range": `${ovFromDate} to ${ovToDate}`,
      Revenue: revenue,
      COGS: cogs,
      "Gross Profit": grossProfit,
      Expenses: totalExpenses,
      "Net Profit": netProfit,
      "Margin %": margin.toFixed(1),
    }];
    downloadCSV(`finance-overview-${ovFromDate}_to_${ovToDate}.csv`, rowsToCSV(rows));
  };

  // ─── Cash Shifts ────────────────────────────────────────────────────────
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [statusFilter, setStatusFilter] = useState("");
  const [reviewFilter, setReviewFilter] = useState("");
  const [page, setPage] = useState(1);

  const [viewShift, setViewShift] = useState<any>(null);
  const [shiftSales, setShiftSales] = useState<any[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState("");

  useEffect(() => {
    if (!canView) { setLoading(false); return; }
    setLoading(true);
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : undefined;
    const to = toDate ? new Date(`${toDate}T23:59:59.999`) : undefined;
    getShifts({ fromDate: from, toDate: to }).then((s) => {
      setShifts(s);
      setLoading(false);
    });
  }, [canView, fromDate, toDate]);

  useEffect(() => {
    setPage(1);
  }, [search, fromDate, toDate, statusFilter, reviewFilter]);

  const filteredShifts = shifts.filter((s) => {
    const matchesSearch = !search || s.cashierName?.toLowerCase().includes(search.toLowerCase()) || s.shiftNo?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (statusFilter && s.status !== statusFilter) return false;
    if (reviewFilter && (s.reviewStatus || (s.status === "open" ? "" : "pending")) !== reviewFilter) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredShifts.length / PAGE_SIZE));
  const paginatedShifts = filteredShifts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalCash = filteredShifts.reduce((sum, s) => sum + (s.cashSalesTotal || 0), 0);
  const totalVariance = filteredShifts.reduce((sum, s) => sum + (s.variance || 0), 0);
  const openCount = filteredShifts.filter((s) => s.status === "open").length;
  const flaggedCount = filteredShifts.filter((s) => s.reviewStatus === "flagged").length;

  const openShiftDetail = async (shift: any) => {
    setViewShift(shift);
    setReviewNote(shift.reviewNote || "");
    setReviewError("");
    setLoadingSales(true);
    const sales = await getSalesByShift(shift.id);
    setShiftSales(sales);
    setLoadingSales(false);
  };

  const closeShiftDetail = () => {
    setViewShift(null);
    setShiftSales([]);
    setReviewNote("");
    setReviewError("");
  };

  const handleReview = async (status: "approved" | "flagged") => {
    if (!viewShift || !user) return;
    setReviewing(true);
    setReviewError("");
    try {
      await reviewShift(viewShift.id, {
        reviewStatus: status,
        reviewNote: reviewNote || undefined,
        performedBy: { uid: user.uid, name: userDisplayName || "Manager" },
      });
      setShifts((prev) => prev.map((s) => (s.id === viewShift.id ? { ...s, reviewStatus: status, reviewNote } : s)));
      setViewShift((prev: any) => (prev ? { ...prev, reviewStatus: status, reviewNote } : prev));
    } catch (err: any) {
      setReviewError(err?.message || "Failed to update review status");
    }
    setReviewing(false);
  };

  const handleExport = () => {
    const rows = filteredShifts.map((s) => ({
      "Shift No.": s.shiftNo,
      Cashier: s.cashierName,
      Status: s.status,
      Opened: s.openedAt,
      Closed: s.closedAt,
      "Opening Float": s.openingFloat,
      "Cash Sales": s.cashSalesTotal,
      "Card Sales": s.cardSalesTotal,
      "Transfer Sales": s.transferSalesTotal,
      "Expected Cash": s.expectedCash,
      "Counted Cash": s.countedCash,
      Variance: s.variance,
      Review: s.reviewStatus,
    }));
    downloadCSV(`cash-shifts-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCSV(rows));
  };

  // ─── Expenses ───────────────────────────────────────────────────────────
  const [expFromDate, setExpFromDate] = useState(monthStartStr());
  const [expToDate, setExpToDate] = useState(todayStr());
  const [expCategoryFilter, setExpCategoryFilter] = useState("");
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expLoading, setExpLoading] = useState(true);
  const [expPage, setExpPage] = useState(1);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newExpenseCategory, setNewExpenseCategory] = useState<ExpenseCategory>("other");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [newExpenseNote, setNewExpenseNote] = useState("");
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState("");
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [deletingExpense, setDeletingExpense] = useState(false);

  const reloadExpenses = async () => {
    const from = expFromDate ? new Date(`${expFromDate}T00:00:00`) : undefined;
    const to = expToDate ? new Date(`${expToDate}T23:59:59.999`) : undefined;
    const e = await getExpenses({ fromDate: from, toDate: to, category: (expCategoryFilter || undefined) as ExpenseCategory | undefined });
    setExpenses(e);
  };

  useEffect(() => {
    if (!canView) { setExpLoading(false); return; }
    setExpLoading(true);
    reloadExpenses().then(() => setExpLoading(false));
  }, [canView, expFromDate, expToDate, expCategoryFilter]);

  useEffect(() => {
    setExpPage(1);
  }, [expFromDate, expToDate, expCategoryFilter]);

  const totalExpensesTab = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const expTotalPages = Math.max(1, Math.ceil(expenses.length / PAGE_SIZE));
  const paginatedExpenses = expenses.slice((expPage - 1) * PAGE_SIZE, expPage * PAGE_SIZE);

  const handleAddExpense = async () => {
    if (!user) return;
    const amount = Number(newExpenseAmount);
    if (!newExpenseAmount || amount <= 0) {
      setExpenseError("Enter a valid amount");
      return;
    }
    setSavingExpense(true);
    setExpenseError("");
    try {
      await addExpense({
        category: newExpenseCategory,
        amount,
        note: newExpenseNote || undefined,
        paidById: user.uid,
        paidByName: userDisplayName || "Manager",
      });
      setShowAddExpense(false);
      setNewExpenseAmount("");
      setNewExpenseNote("");
      setNewExpenseCategory("other");
      await reloadExpenses();
    } catch (err: any) {
      setExpenseError(err?.message || "Failed to add expense");
    }
    setSavingExpense(false);
  };

  const handleDeleteExpense = async () => {
    if (!deleteExpenseId) return;
    setDeletingExpense(true);
    try {
      await deleteExpense(deleteExpenseId);
      setExpenses((prev) => prev.filter((e) => e.id !== deleteExpenseId));
      setDeleteExpenseId(null);
    } catch (err: any) {
      alert(err?.message || "Failed to delete expense");
    }
    setDeletingExpense(false);
  };

  const handleExportExpenses = () => {
    const rows = expenses.map((e) => ({
      "Expense No.": e.expenseNo,
      Category: EXPENSE_CATEGORY_LABEL[e.category] || e.category,
      Amount: e.amount,
      Note: e.note,
      "Paid By": e.paidByName,
      Date: e.createdAt,
    }));
    downloadCSV(`expenses-${expFromDate}_to_${expToDate}.csv`, rowsToCSV(rows));
  };

  if (!canView) {
    return (
      <div className="p-4 sm:p-8">
        <div className="nexora-card p-8 text-center max-w-md mx-auto">
          <Wallet size={24} className="text-zinc-300 mx-auto mb-3" />
          <h1 className="font-prata text-lg text-black mb-1">Access Restricted</h1>
          <p className="text-sm text-zinc-500">Only Manager and above can view the Finance section.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <h1 className="font-prata text-2xl text-black">Finance</h1>
        <div className="flex items-center gap-1 bg-zinc-100 rounded p-1">
          {(["overview", "shifts", "expenses"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded capitalize transition-colors ${
                tab === t ? "bg-white text-black shadow-sm" : "text-zinc-500 hover:text-black"
              }`}
            >
              {t === "shifts" ? "Cash Shifts" : t}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Overview tab ─── */}
      {tab === "overview" && (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <input type="date" aria-label="From date" className="nexora-input w-auto" value={ovFromDate} max={ovToDate || undefined} onChange={(e) => setOvFromDate(e.target.value)} />
            <span className="text-zinc-300 text-xs">–</span>
            <input type="date" aria-label="To date" className="nexora-input w-auto" value={ovToDate} min={ovFromDate || undefined} onChange={(e) => setOvToDate(e.target.value)} />
            {(ovFromDate !== monthStartStr() || ovToDate !== todayStr()) && (
              <button onClick={() => { setOvFromDate(monthStartStr()); setOvToDate(todayStr()); }} className="nexora-btn nexora-btn-ghost text-xs py-2">Reset</button>
            )}
            <button onClick={handleExportOverview} className="nexora-btn nexora-btn-outline text-xs">
              <Download size={12} /> Download CSV
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-4">
            {kpiCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="nexora-card p-4 sm:p-5 min-w-0">
                  <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
                    <p className="text-[11px] sm:text-xs text-zinc-500 uppercase tracking-wider">{card.label}</p>
                    <Icon size={14} className="text-zinc-400 shrink-0" />
                  </div>
                  <p className="font-prata text-lg sm:text-2xl text-black truncate">{ovLoading ? "…" : card.value}</p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-zinc-400 mb-8">
            Net Profit = Gross Profit − Expenses logged here. Supplier payments aren't subtracted again — they fund inventory
            purchases already priced into Cost of Goods Sold above.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
            <div className="nexora-card p-4 sm:p-5 min-w-0">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-4">Payment Methods</p>
              {ovLoading ? (
                <p className="text-sm text-zinc-400 text-center py-10">Loading…</p>
              ) : paymentBreakdown.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-10">No sales in range</p>
              ) : (
                <div className="space-y-3">
                  {paymentBreakdown.map((p) => (
                    <div key={p.method}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="capitalize text-zinc-600">{p.method}</span>
                        <span className="font-medium">Rs. {p.amount.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div className="h-full bg-black rounded-full" style={{ width: `${p.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-2 nexora-card overflow-x-auto min-w-0">
              <p className="text-xs text-zinc-500 uppercase tracking-wider px-4 sm:px-5 pt-4 sm:pt-5 mb-2">Cashier Performance</p>
              <table className="w-full text-sm min-w-[420px]">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="text-left px-4 py-2 text-xs text-zinc-500 font-medium uppercase tracking-wider">Cashier</th>
                    <th className="text-left px-4 py-2 text-xs text-zinc-500 font-medium uppercase tracking-wider">Sales</th>
                    <th className="text-left px-4 py-2 text-xs text-zinc-500 font-medium uppercase tracking-wider">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {ovLoading ? (
                    <tr><td colSpan={3} className="text-center py-8 text-zinc-400">Loading…</td></tr>
                  ) : cashierBreakdown.length === 0 ? (
                    <tr><td colSpan={3} className="text-center py-8 text-zinc-400">No sales in range</td></tr>
                  ) : (
                    cashierBreakdown.map((c) => (
                      <tr key={c.name}>
                        <td className="px-4 py-2.5 font-medium text-black">{c.name}</td>
                        <td className="px-4 py-2.5 text-zinc-600">{c.count}</td>
                        <td className="px-4 py-2.5">Rs. {c.revenue.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <h2 className="font-prata text-lg text-black">Supplier Payables</h2>
            <a href="/suppliers/payments" className="text-xs text-zinc-500 hover:text-black underline">View full report →</a>
          </div>
          <div className="nexora-card overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Supplier</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {ovLoading ? (
                  <tr><td colSpan={2} className="text-center py-8 text-zinc-400">Loading…</td></tr>
                ) : outstandingSuppliers.length === 0 ? (
                  <tr><td colSpan={2} className="text-center py-8 text-zinc-400">Nothing outstanding</td></tr>
                ) : (
                  outstandingSuppliers.slice(0, 5).map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-2.5 font-medium text-black">{s.name}</td>
                      <td className="px-4 py-2.5">Rs. {s.balance?.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {outstandingSuppliers.length > 0 && (
                <tfoot>
                  <tr className="border-t border-zinc-100">
                    <td className="px-4 py-2.5 font-medium">Total outstanding</td>
                    <td className="px-4 py-2.5 font-medium">Rs. {totalPayables.toLocaleString()}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ─── Cash Shifts tab ─── */}
      {tab === "shifts" && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <p className="text-zinc-500 text-sm">{filteredShifts.length} shifts in range · {openCount} still open · {flaggedCount} flagged</p>
            <div className="flex gap-6 sm:text-right">
              <div>
                <p className="text-xs text-zinc-400 uppercase tracking-wider">Cash Sales</p>
                <p className="font-poppins font-semibold text-lg text-black">Rs. {totalCash.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 uppercase tracking-wider">Variance</p>
                <p className={`font-poppins font-semibold text-lg ${totalVariance === 0 ? "text-black" : "text-red-600"}`}>Rs. {totalVariance.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-6">
            <div className="relative flex-1 min-w-[200px] sm:max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input className="nexora-input pl-9" placeholder="Search cashier or shift no…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <input type="date" aria-label="From date" className="nexora-input w-auto" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} />
            <span className="text-zinc-300 text-xs">–</span>
            <input type="date" aria-label="To date" className="nexora-input w-auto" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} />
            <select className="nexora-input w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
            <select className="nexora-input w-auto" value={reviewFilter} onChange={(e) => setReviewFilter(e.target.value)}>
              <option value="">All reviews</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="flagged">Flagged</option>
            </select>
            {(search || statusFilter || reviewFilter) && (
              <button onClick={() => { setSearch(""); setStatusFilter(""); setReviewFilter(""); }} className="nexora-btn nexora-btn-ghost text-xs py-2">Clear</button>
            )}
            <button onClick={handleExport} disabled={filteredShifts.length === 0} className="nexora-btn nexora-btn-outline text-xs disabled:opacity-50 disabled:cursor-not-allowed">
              <Download size={12} /> Download CSV
            </button>
          </div>

          <div className="nexora-card overflow-x-auto">
            <table className="w-full text-sm min-w-[960px]">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Shift No.</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Cashier</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Opened</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Closed</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Float</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Cash</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Card</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Expected</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Counted</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Variance</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {loading ? (
                  <tr><td colSpan={11} className="text-center py-10 text-zinc-400">Loading…</td></tr>
                ) : filteredShifts.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-10 text-zinc-400">No shifts found</td></tr>
                ) : (
                  paginatedShifts.map((s) => (
                    <tr key={s.id} onClick={() => openShiftDetail(s)} className="hover:bg-zinc-50 transition-colors cursor-pointer">
                      <td className="px-4 py-3 font-medium text-black hover:underline">{s.shiftNo}</td>
                      <td className="px-4 py-3 text-zinc-600">{s.cashierName}</td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(s.openedAt)}</td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{s.status === "open" ? <span className="badge badge-warning">Open</span> : formatDate(s.closedAt)}</td>
                      <td className="px-4 py-3">Rs. {s.openingFloat?.toLocaleString()}</td>
                      <td className="px-4 py-3">Rs. {s.cashSalesTotal?.toLocaleString()}</td>
                      <td className="px-4 py-3">Rs. {s.cardSalesTotal?.toLocaleString()}</td>
                      <td className="px-4 py-3">{s.status === "closed" ? `Rs. ${s.expectedCash?.toLocaleString()}` : "—"}</td>
                      <td className="px-4 py-3">{s.status === "closed" ? `Rs. ${s.countedCash?.toLocaleString()}` : "—"}</td>
                      <td className={`px-4 py-3 font-medium ${s.status === "closed" && s.variance !== 0 ? "text-red-600" : ""}`}>
                        {s.status === "closed" ? `Rs. ${s.variance?.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {s.status === "closed" && (
                          <span className={`badge ${REVIEW_BADGE[s.reviewStatus || "pending"]}`}>{REVIEW_LABEL[s.reviewStatus || "pending"]}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination page={page} totalPages={totalPages} totalItems={filteredShifts.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

          {viewShift && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 sticky top-0 bg-white">
                  <h2 className="font-prata text-base">{viewShift.shiftNo} — {viewShift.cashierName}</h2>
                  <button onClick={closeShiftDetail}><X size={16} className="text-zinc-400" /></button>
                </div>
                <div className="p-4 space-y-4">
                  <div className="bg-zinc-50 rounded p-3 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-zinc-500">Status</span><span>{viewShift.status === "open" ? <span className="badge badge-warning">Open</span> : "Closed"}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Opened</span><span>{formatDate(viewShift.openedAt)}</span></div>
                    {viewShift.status === "closed" && <div className="flex justify-between"><span className="text-zinc-500">Closed</span><span>{formatDate(viewShift.closedAt)}</span></div>}
                    <div className="flex justify-between"><span className="text-zinc-500">Opening float</span><span>Rs. {viewShift.openingFloat?.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Cash sales</span><span>Rs. {viewShift.cashSalesTotal?.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Card sales</span><span>Rs. {viewShift.cardSalesTotal?.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Transfer sales</span><span>Rs. {viewShift.transferSalesTotal?.toLocaleString()}</span></div>
                    {viewShift.status === "closed" && (
                      <>
                        <div className="flex justify-between border-t border-zinc-200 pt-1 mt-1"><span className="text-zinc-500">Expected cash</span><span>Rs. {viewShift.expectedCash?.toLocaleString()}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-500">Counted cash</span><span>Rs. {viewShift.countedCash?.toLocaleString()}</span></div>
                        <div className={`flex justify-between font-medium ${viewShift.variance === 0 ? "text-green-600" : "text-red-600"}`}>
                          <span>Variance</span><span>{viewShift.variance === 0 ? "Balanced" : `Rs. ${viewShift.variance?.toLocaleString()}`}</span>
                        </div>
                      </>
                    )}
                    {viewShift.closeNote && <div className="pt-1"><span className="text-zinc-500">Note: </span>{viewShift.closeNote}</div>}
                  </div>

                  <div>
                    <h3 className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-2">Sales this shift ({shiftSales.length})</h3>
                    {loadingSales ? (
                      <p className="text-xs text-zinc-400 text-center py-3">Loading…</p>
                    ) : shiftSales.length === 0 ? (
                      <p className="text-xs text-zinc-400 text-center py-3">No sales recorded</p>
                    ) : (
                      <div className="divide-y divide-zinc-50 max-h-40 overflow-y-auto border border-zinc-100 rounded">
                        {shiftSales.map((sale) => (
                          <div key={sale.id} className="flex items-center justify-between px-3 py-2 text-sm">
                            <span>{sale.invoiceNo}</span>
                            <span className="text-zinc-400 text-xs capitalize">{sale.paymentMethod}</span>
                            <span className="font-medium">Rs. {sale.totalAmount?.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {viewShift.status === "closed" && canReview && (
                    <div className="space-y-2 border-t border-zinc-100 pt-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Review</h3>
                        <span className={`badge ${REVIEW_BADGE[viewShift.reviewStatus || "pending"]}`}>{REVIEW_LABEL[viewShift.reviewStatus || "pending"]}</span>
                      </div>
                      <input
                        className="nexora-input"
                        placeholder="Review note (optional)"
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                      />
                      {reviewError && <p className="text-xs text-red-600">{reviewError}</p>}
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleReview("approved")} disabled={reviewing} className="nexora-btn nexora-btn-outline justify-center">
                          Approve
                        </button>
                        <button onClick={() => handleReview("flagged")} disabled={reviewing} className="nexora-btn nexora-btn-outline justify-center text-red-600 border-red-200 hover:border-red-400">
                          Flag
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Expenses tab ─── */}
      {tab === "expenses" && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <p className="text-zinc-500 text-sm">{expenses.length} expenses in range</p>
            <div className="sm:text-right">
              <p className="text-xs text-zinc-400 uppercase tracking-wider">Total Expenses</p>
              <p className="font-poppins font-semibold text-xl text-black">Rs. {totalExpensesTab.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-6">
            <input type="date" aria-label="From date" className="nexora-input w-auto" value={expFromDate} max={expToDate || undefined} onChange={(e) => setExpFromDate(e.target.value)} />
            <span className="text-zinc-300 text-xs">–</span>
            <input type="date" aria-label="To date" className="nexora-input w-auto" value={expToDate} min={expFromDate || undefined} onChange={(e) => setExpToDate(e.target.value)} />
            <select className="nexora-input w-auto" value={expCategoryFilter} onChange={(e) => setExpCategoryFilter(e.target.value)}>
              <option value="">All categories</option>
              {EXPENSE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            {expCategoryFilter && (
              <button onClick={() => setExpCategoryFilter("")} className="nexora-btn nexora-btn-ghost text-xs py-2">Clear</button>
            )}
            <button onClick={handleExportExpenses} disabled={expenses.length === 0} className="nexora-btn nexora-btn-outline text-xs disabled:opacity-50 disabled:cursor-not-allowed">
              <Download size={12} /> Download CSV
            </button>
            {canAddExpense && (
              <button onClick={() => setShowAddExpense(true)} className="nexora-btn nexora-btn-primary text-xs ml-auto">
                <Plus size={12} /> Add Expense
              </button>
            )}
          </div>

          <div className="nexora-card overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Expense No.</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Category</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Amount</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Note</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Paid By</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Date</th>
                  {canDeleteExpense && <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {expLoading ? (
                  <tr><td colSpan={7} className="text-center py-10 text-zinc-400">Loading…</td></tr>
                ) : expenses.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-zinc-400">No expenses found</td></tr>
                ) : (
                  paginatedExpenses.map((e) => (
                    <tr key={e.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-black">{e.expenseNo}</td>
                      <td className="px-4 py-3">{EXPENSE_CATEGORY_LABEL[e.category] || e.category}</td>
                      <td className="px-4 py-3 font-medium">Rs. {e.amount?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-zinc-600">{e.note || "—"}</td>
                      <td className="px-4 py-3 text-zinc-600">{e.paidByName}</td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(e.createdAt)}</td>
                      {canDeleteExpense && (
                        <td className="px-4 py-3">
                          <button onClick={() => setDeleteExpenseId(e.id)} className="text-zinc-300 hover:text-red-500 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination page={expPage} totalPages={expTotalPages} totalItems={expenses.length} pageSize={PAGE_SIZE} onPageChange={setExpPage} />
        </div>
      )}

      {/* Add expense modal */}
      {showAddExpense && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
              <h2 className="font-prata text-base">Add Expense</h2>
              <button onClick={() => setShowAddExpense(false)}><X size={16} className="text-zinc-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Category</label>
                <select className="nexora-input" value={newExpenseCategory} onChange={(e) => setNewExpenseCategory(e.target.value as ExpenseCategory)}>
                  {EXPENSE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Amount</label>
                <input type="number" min={0} autoFocus className="nexora-input" placeholder="0" value={newExpenseAmount} onChange={(e) => setNewExpenseAmount(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Note (optional)</label>
                <input className="nexora-input" placeholder="e.g. July shop rent" value={newExpenseNote} onChange={(e) => setNewExpenseNote(e.target.value)} />
              </div>
              {expenseError && <p className="text-xs text-red-600">{expenseError}</p>}
              <button onClick={handleAddExpense} disabled={savingExpense} className="nexora-btn nexora-btn-primary w-full justify-center">
                {savingExpense ? "Saving…" : "Add Expense"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteExpenseId}
        title="Delete expense?"
        message="This expense will be permanently removed. This action cannot be undone."
        loading={deletingExpense}
        onConfirm={handleDeleteExpense}
        onCancel={() => setDeleteExpenseId(null)}
      />
    </div>
  );
}
