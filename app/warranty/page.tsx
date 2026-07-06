"use client";
import { useEffect, useState } from "react";
import { getWarranties, claimWarranty } from "@/lib/firestore";
import { Warranty } from "@/types";
import { Search, Shield, AlertTriangle, Check, ShieldCheck } from "lucide-react";
import Pagination from "@/components/ui/Pagination";

const PAGE_SIZE = 10;

type StatusKey = "active" | "expiring" | "expired" | "claimed";

export default function WarrantyPage() {
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey | "">("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [claimTarget, setClaimTarget] = useState<Warranty | null>(null);
  const [claimNote, setClaimNote] = useState("");
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    getWarranties().then((w) => { setWarranties(w as Warranty[]); setLoading(false); });
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const formatDate = (val: any) => {
    if (!val) return "—";
    const d = val.toDate ? val.toDate() : new Date(val);
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  };

  const getStatus = (w: Warranty): { key: StatusKey; label: string; color: string } => {
    if (w.status === "claimed") return { key: "claimed", label: "Claimed", color: "badge-default" };
    const end = w.endDate?.toDate ? w.endDate.toDate() : new Date(w.endDate);
    const now = new Date();
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { key: "expired", label: "Expired", color: "badge-danger" };
    if (daysLeft <= 30) return { key: "expiring", label: `${daysLeft}d left`, color: "badge-warning" };
    return { key: "active", label: "Active", color: "badge-success" };
  };

  const filtered = warranties.filter((w) => {
    const matchesSearch =
      w.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      w.productName?.toLowerCase().includes(search.toLowerCase()) ||
      w.serialNumber?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (statusFilter && getStatus(w).key !== statusFilter) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = warranties.reduce(
    (acc, w) => {
      acc[getStatus(w).key]++;
      return acc;
    },
    { active: 0, expiring: 0, expired: 0, claimed: 0 } as Record<StatusKey, number>
  );

  const openClaim = (w: Warranty) => {
    setClaimTarget(w);
    setClaimNote("");
  };

  const handleClaim = async () => {
    if (!claimTarget) return;
    setClaiming(true);
    try {
      await claimWarranty(claimTarget.id, claimNote.trim());
      setWarranties((ws) =>
        ws.map((w) =>
          w.id === claimTarget.id ? { ...w, status: "claimed", claimNote: claimNote.trim(), claimedAt: new Date() } : w
        )
      );
      setClaimTarget(null);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="font-prata text-2xl text-black">Warranty</h1>
        <p className="text-zinc-500 text-sm mt-1">Track product warranties by sale</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
          <p className="font-prata text-2xl text-black">{stats.expiring}</p>
        </div>
        <div className="nexora-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Shield size={14} className="text-zinc-400" />
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Expired</p>
          </div>
          <p className="font-prata text-2xl text-black">{stats.expired}</p>
        </div>
        <div className="nexora-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={14} className="text-violet-500" />
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Claimed</p>
          </div>
          <p className="font-prata text-2xl text-black">{stats.claimed}</p>
        </div>
      </div>

      {/* Search & filter */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="relative flex-1 min-w-[200px] sm:max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            className="nexora-input pl-9"
            placeholder="Search customer or product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="nexora-input w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusKey | "")}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="expiring">Expiring Soon</option>
          <option value="expired">Expired</option>
          <option value="claimed">Claimed</option>
        </select>
        {statusFilter && (
          <button onClick={() => setStatusFilter("")} className="nexora-btn nexora-btn-ghost text-xs py-2">
            Clear
          </button>
        )}
      </div>

      <div className="nexora-card overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Customer</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Product</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Serial No.</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Start</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">End</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-zinc-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-zinc-400">No warranties found</td></tr>
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
                      <span className={`badge ${status.color}`} title={w.claimNote || undefined}>{status.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      {status.key !== "claimed" && (
                        <button onClick={() => openClaim(w)} className="nexora-btn nexora-btn-outline py-1 px-2.5 text-xs whitespace-nowrap">
                          <ShieldCheck size={12} /> Claim
                        </button>
                      )}
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

      {/* Claim modal */}
      {claimTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-zinc-100">
              <h2 className="font-prata text-lg text-black">Claim Warranty</h2>
              <p className="text-xs text-zinc-500 mt-1">{claimTarget.productName} · {claimTarget.customerName}</p>
            </div>
            <div className="px-6 py-4">
              <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Note (reason, repair, replacement, etc.)</label>
              <textarea
                className="nexora-input resize-none"
                rows={3}
                autoFocus
                value={claimNote}
                onChange={(e) => setClaimNote(e.target.value)}
                placeholder="e.g. Screen replaced under warranty"
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setClaimTarget(null)}
                  disabled={claiming}
                  className="nexora-btn nexora-btn-outline flex-1 justify-center disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClaim}
                  disabled={claiming}
                  className="nexora-btn nexora-btn-primary flex-1 justify-center disabled:opacity-70"
                >
                  {claiming ? "Claiming…" : "Confirm Claim"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
