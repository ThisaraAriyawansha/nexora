"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupplierPayments, getSuppliers } from "@/lib/firestore";
import { Search, ArrowLeft, Download } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { rowsToCSV, downloadCSV } from "@/lib/csv";

const PAGE_SIZE = 20;

const STATUS_BADGE: Record<string, string> = {
  paid: "badge-success",
  partial: "badge-warning",
  outstanding: "badge-danger",
};

const STATUS_LABEL: Record<string, string> = {
  paid: "Paid",
  partial: "Partial",
  outstanding: "Outstanding",
};

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  cheque: "Cheque",
  other: "Other",
};

export default function SupplierPaymentsReportPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    Promise.all([getSupplierPayments(), getSuppliers()]).then(([p, s]) => {
      setPayments(p);
      setSuppliers(s);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, fromDate, toDate]);

  const formatDate = (ts: any) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const filteredPayments = payments.filter((p) => {
    const matchesSearch = !search || p.supplierName?.toLowerCase().includes(search.toLowerCase()) || p.paymentNo?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (fromDate || toDate) {
      const created = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
      if (fromDate && created < new Date(`${fromDate}T00:00:00`)) return false;
      if (toDate && created > new Date(`${toDate}T23:59:59.999`)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / PAGE_SIZE));
  const paginatedPayments = filteredPayments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalCollected = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  const outstanding = [...suppliers].filter((s) => (s.balance ?? 0) > 0).sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));

  const handleExportPayments = () => {
    const rows = filteredPayments.map((p) => ({
      "Payment No.": p.paymentNo,
      Supplier: p.supplierName,
      Amount: p.amount,
      Method: METHOD_LABEL[p.method] || p.method,
      "Balance After": p.balanceAfter,
      "Paid By": p.paidByName,
      Date: p.createdAt,
    }));
    downloadCSV(`supplier-payments-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCSV(rows));
  };

  const handleExportOutstanding = () => {
    const rows = outstanding.map((s) => ({
      Supplier: s.name,
      "Total Payable": s.totalPayable,
      "Amount Paid": s.amountPaid,
      Balance: s.balance,
      Status: STATUS_LABEL[s.paymentStatus] || s.paymentStatus,
    }));
    downloadCSV(`outstanding-balances-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCSV(rows));
  };

  return (
    <div className="p-4 sm:p-8">
      <Link href="/suppliers" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-black mb-4">
        <ArrowLeft size={14} /> Back to Suppliers
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-prata text-2xl text-black">Supplier Payment Report</h1>
          <p className="text-zinc-500 text-sm mt-1">{filteredPayments.length} payments in range</p>
        </div>
        <div className="sm:text-right">
          <p className="text-xs text-zinc-400 uppercase tracking-wider">Total Collected</p>
          <p className="font-poppins font-semibold text-xl text-black">Rs. {totalCollected.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="relative flex-1 min-w-[200px] sm:max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input className="nexora-input pl-9" placeholder="Search supplier or payment no…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <input type="date" aria-label="From date" className="nexora-input w-auto" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} />
        <span className="text-zinc-300 text-xs">–</span>
        <input type="date" aria-label="To date" className="nexora-input w-auto" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} />
        {(fromDate || toDate || search) && (
          <button onClick={() => { setFromDate(""); setToDate(""); setSearch(""); }} className="nexora-btn nexora-btn-ghost text-xs py-2">Clear</button>
        )}
        <button onClick={handleExportPayments} disabled={filteredPayments.length === 0} className="nexora-btn nexora-btn-outline text-xs disabled:opacity-50 disabled:cursor-not-allowed">
          <Download size={12} /> Download CSV
        </button>
      </div>

      <div className="nexora-card overflow-x-auto mb-8">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Payment No.</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Supplier</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Amount</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Method</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Paid By</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-zinc-400">Loading…</td></tr>
            ) : filteredPayments.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-zinc-400">No payments found</td></tr>
            ) : (
              paginatedPayments.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-black">{p.paymentNo}</td>
                  <td className="px-4 py-3 text-zinc-600">{p.supplierName}</td>
                  <td className="px-4 py-3 font-medium">Rs. {p.amount?.toLocaleString()}</td>
                  <td className="px-4 py-3">{METHOD_LABEL[p.method] || p.method}</td>
                  <td className="px-4 py-3 text-zinc-600">{p.paidByName}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(p.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} totalItems={filteredPayments.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      <div className="flex items-center justify-between mt-10 mb-3">
        <h2 className="font-prata text-lg text-black">Outstanding Balances</h2>
        <button onClick={handleExportOutstanding} disabled={outstanding.length === 0} className="nexora-btn nexora-btn-outline text-xs disabled:opacity-50 disabled:cursor-not-allowed">
          <Download size={12} /> Download CSV
        </button>
      </div>
      <div className="nexora-card overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Supplier</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Total Payable</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Amount Paid</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Balance</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {outstanding.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-zinc-400">Nothing outstanding</td></tr>
            ) : (
              outstanding.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-black">{s.name}</td>
                  <td className="px-4 py-3">Rs. {s.totalPayable?.toLocaleString()}</td>
                  <td className="px-4 py-3">Rs. {s.amountPaid?.toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium">Rs. {s.balance?.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_BADGE[s.paymentStatus] || "badge-default"}`}>{STATUS_LABEL[s.paymentStatus] || s.paymentStatus}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
