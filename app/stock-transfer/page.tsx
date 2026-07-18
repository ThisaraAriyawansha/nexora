"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getStockTransfers, getStockTransfer, adminUpdateStockTransfer } from "@/lib/firestore";
import { useAuth } from "@/hooks/useAuth";
import { Search, Plus, Eye, X, ArrowLeftRight, Download, Pencil } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { rowsToCSV, downloadCSV } from "@/lib/csv";

const PAGE_SIZE = 10;

export default function StockTransferPage() {
  const { user, userDisplayName, userRole } = useAuth();
  const canManageStock = userRole === "Super Admin" || userRole === "Admin" || userRole === "Manager";
  const canAdminEdit = userRole === "Super Admin" || userRole === "Admin";

  const [transfers, setTransfers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [viewTransfer, setViewTransfer] = useState<any>(null);
  const [editingTransfer, setEditingTransfer] = useState(false);
  const [editNote, setEditNote] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    getStockTransfers().then((t) => { setTransfers(t); setLoading(false); });
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, fromDate, toDate]);

  const openTransfer = async (id: string) => {
    setViewTransfer(await getStockTransfer(id));
    setEditingTransfer(false);
  };

  const openEditTransfer = () => {
    setEditNote(viewTransfer?.note || "");
    setEditingTransfer(true);
  };

  const handleSaveEdit = async () => {
    if (!viewTransfer) return;
    setSavingEdit(true);
    try {
      await adminUpdateStockTransfer(
        viewTransfer.id,
        { note: editNote },
        { uid: user!.uid, name: userDisplayName || user?.email || "Admin" }
      );
      setViewTransfer(await getStockTransfer(viewTransfer.id));
      await getStockTransfers().then(setTransfers);
      setEditingTransfer(false);
    } finally {
      setSavingEdit(false);
    }
  };

  const filtered = transfers.filter((t) => {
    const matchesSearch =
      t.transferNo?.toLowerCase().includes(search.toLowerCase()) ||
      t.transferredByName?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (fromDate || toDate) {
      const created = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
      if (fromDate && created < new Date(`${fromDate}T00:00:00`)) return false;
      if (toDate && created > new Date(`${toDate}T23:59:59.999`)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const formatDate = (ts: any) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const handleExportCSV = () => {
    const rows = filtered.map((t) => ({
      "Transfer No.": t.transferNo,
      "Transferred By": t.transferredByName,
      Note: t.note || "",
      Date: t.createdAt,
    }));
    downloadCSV(`stock-transfer-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCSV(rows));
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-prata text-2xl text-black">Stock Transfer</h1>
          <p className="text-zinc-500 text-sm mt-1">{transfers.length} transfers · Stores → Showroom</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleExportCSV}
            disabled={filtered.length === 0}
            className="nexora-btn nexora-btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={14} /> Download CSV
          </button>
          {canManageStock && (
            <Link href="/stock-transfer/new" className="nexora-btn nexora-btn-primary">
              <Plus size={14} /> New Transfer
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="relative flex-1 min-w-[200px] sm:max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            className="nexora-input pl-9"
            placeholder="Search transfer no. or staff…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <input type="date" aria-label="From date" className="nexora-input w-auto" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} />
        <span className="text-zinc-300 text-xs">–</span>
        <input type="date" aria-label="To date" className="nexora-input w-auto" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} />
        {(fromDate || toDate) && (
          <button onClick={() => { setFromDate(""); setToDate(""); }} className="nexora-btn nexora-btn-ghost text-xs py-2">
            Clear
          </button>
        )}
      </div>

      <div className="nexora-card overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Transfer No.</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Transferred By</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Date</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {loading ? (
              <tr><td colSpan={4} className="text-center py-10 text-zinc-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-10 text-zinc-400">No transfers found</td></tr>
            ) : (
              paginated.map((t) => (
                <tr key={t.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-black">{t.transferNo}</td>
                  <td className="px-4 py-3 text-zinc-600">{t.transferredByName}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(t.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => openTransfer(t.id)} className="nexora-btn nexora-btn-ghost py-1 px-2 text-xs">
                      <Eye size={12} /> View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {viewTransfer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-zinc-100 sticky top-0 bg-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowLeftRight size={16} className="text-zinc-400" />
                <h2 className="font-prata text-lg">{viewTransfer.transferNo}</h2>
              </div>
              <div className="flex items-center gap-2">
                {canAdminEdit && !editingTransfer && (
                  <button onClick={openEditTransfer} className="nexora-btn nexora-btn-ghost py-1 px-2 text-xs">
                    <Pencil size={12} /> Edit
                  </button>
                )}
                <button onClick={() => setViewTransfer(null)} className="text-zinc-400 hover:text-black">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Transferred By</p>
                  <p className="text-sm font-medium">{viewTransfer.transferredByName}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Date</p>
                  <p className="text-sm font-medium">{formatDate(viewTransfer.createdAt)}</p>
                </div>
              </div>
              {editingTransfer ? (
                <div className="nexora-card p-3 mb-4 space-y-2">
                  <label className="text-xs text-zinc-500 block">Note</label>
                  <textarea className="nexora-input" rows={2} value={editNote} onChange={(e) => setEditNote(e.target.value)} />
                  <div className="flex gap-2">
                    <button onClick={handleSaveEdit} disabled={savingEdit} className="nexora-btn nexora-btn-primary text-xs py-1.5 disabled:opacity-60">
                      {savingEdit ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => setEditingTransfer(false)} className="nexora-btn nexora-btn-outline text-xs py-1.5">Cancel</button>
                  </div>
                </div>
              ) : viewTransfer.note ? (
                <p className="text-xs text-zinc-500 mb-4 bg-zinc-50 rounded-lg px-3 py-2">{viewTransfer.note}</p>
              ) : null}
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      <th className="text-left py-2 text-xs text-zinc-500 font-medium">Item</th>
                      <th className="text-center py-2 text-xs text-zinc-500 font-medium">Qty</th>
                      <th className="text-left py-2 text-xs text-zinc-500 font-medium">Serials</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {viewTransfer.items?.map((item: any) => (
                      <tr key={item.id}>
                        <td className="py-2.5">
                          <p className="font-medium text-black">{item.productName}</p>
                          <p className="text-xs text-zinc-400">{item.sku}</p>
                        </td>
                        <td className="py-2.5 text-center">{item.qty}</td>
                        <td className="py-2.5 text-xs text-zinc-400 font-mono">{item.serialNumbers?.join(", ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
