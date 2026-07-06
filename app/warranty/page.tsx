"use client";
import { useEffect, useState } from "react";
import { getWarranties } from "@/lib/firestore";
import { Warranty } from "@/types";
import { Search, Shield, AlertTriangle, Check } from "lucide-react";
import Pagination from "@/components/ui/Pagination";

const PAGE_SIZE = 10;

export default function WarrantyPage() {
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    getWarranties().then((w) => { setWarranties(w as Warranty[]); setLoading(false); });
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const filtered = warranties.filter(
    (w) =>
      w.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      w.productName?.toLowerCase().includes(search.toLowerCase()) ||
      w.serialNumber?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const formatDate = (val: any) => {
    if (!val) return "—";
    const d = val.toDate ? val.toDate() : new Date(val);
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  };

  const getStatus = (w: Warranty) => {
    const end = w.endDate?.toDate ? w.endDate.toDate() : new Date(w.endDate);
    const now = new Date();
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { label: "Expired", color: "badge-danger", icon: "x" };
    if (daysLeft <= 30) return { label: `${daysLeft}d left`, color: "badge-warning", icon: "warn" };
    return { label: "Active", color: "badge-success", icon: "check" };
  };

  const stats = {
    active: warranties.filter((w) => {
      const end = w.endDate?.toDate ? w.endDate.toDate() : new Date(w.endDate);
      return end > new Date();
    }).length,
    expired: warranties.filter((w) => {
      const end = w.endDate?.toDate ? w.endDate.toDate() : new Date(w.endDate);
      return end <= new Date();
    }).length,
    expiringSoon: warranties.filter((w) => {
      const end = w.endDate?.toDate ? w.endDate.toDate() : new Date(w.endDate);
      const daysLeft = Math.ceil((end.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return daysLeft > 0 && daysLeft <= 30;
    }).length,
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="font-prata text-2xl text-black">Warranty</h1>
        <p className="text-zinc-500 text-sm mt-1">Track product warranties by sale</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="nexora-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Check size={14} className="text-green-500" />
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Active</p>
          </div>
          <p className="font-prata text-2xl text-black">{stats.active}</p>
        </div>
        <div className="nexora-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-amber-500" />
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Expiring Soon</p>
          </div>
          <p className="font-prata text-2xl text-black">{stats.expiringSoon}</p>
        </div>
        <div className="nexora-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Shield size={14} className="text-zinc-400" />
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Expired</p>
          </div>
          <p className="font-prata text-2xl text-black">{stats.expired}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6 sm:max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          className="nexora-input pl-9"
          placeholder="Search customer or product…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="nexora-card overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Customer</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Product</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Serial No.</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Start</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">End</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-zinc-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-zinc-400">No warranties found</td></tr>
            ) : (
              paginated.map((w) => {
                const status = getStatus(w);
                return (
                  <tr key={w.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-black">{w.customerName}</td>
                    <td className="px-4 py-3 text-zinc-600">{w.productName}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs font-mono">{w.serialNumber || "—"}</td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(w.startDate)}</td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(w.endDate)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${status.color}`}>{status.label}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      <p className="text-xs text-zinc-400 mt-4">
        Warranties are automatically created when a product with warranty months is sold.
      </p>
    </div>
  );
}
