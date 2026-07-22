"use client";
import { useEffect, useState } from "react";
import { getAuditLog } from "@/lib/firestore";
import { useAuth } from "@/hooks/useAuth";
import { Search, X, ShieldCheck, Download } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { rowsToCSV, downloadCSV } from "@/lib/csv";

const PAGE_SIZE = 20;

const COLLECTION_LABELS: Record<string, string> = {
  jobs: "Job",
  grns: "GRN",
  stockTransfers: "Stock Transfer",
  stockOuts: "Stock Out",
  sales: "Sale",
  supplierPayments: "Supplier Payment",
};

const COLLECTION_OPTIONS = Object.entries(COLLECTION_LABELS).map(([value, label]) => ({ value, label }));

export default function AuditLogPage() {
  const { can } = useAuth();
  const canView = can("auditLog.view");

  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [viewEntry, setViewEntry] = useState<any>(null);

  useEffect(() => {
    if (!canView) { setLoading(false); return; }
    getAuditLog().then((e) => { setEntries(e); setLoading(false); });
  }, [canView]);

  useEffect(() => {
    setPage(1);
  }, [search, fromDate, toDate, collectionFilter]);

  const formatDate = (ts: any) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const filtered = entries.filter((e) => {
    const matchesSearch =
      !search ||
      e.label?.toLowerCase().includes(search.toLowerCase()) ||
      e.performedByName?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (collectionFilter && e.collectionName !== collectionFilter) return false;
    if (fromDate || toDate) {
      const created = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
      if (fromDate && created < new Date(`${fromDate}T00:00:00`)) return false;
      if (toDate && created > new Date(`${toDate}T23:59:59.999`)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExportCSV = () => {
    const rows = filtered.map((e) => ({
      Date: e.createdAt,
      Who: e.performedByName,
      Type: COLLECTION_LABELS[e.collectionName] || e.collectionName,
      Record: e.label,
      Changes: e.changes,
    }));
    downloadCSV(`audit-log-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCSV(rows));
  };

  if (!canView) {
    return (
      <div className="p-4 sm:p-8">
        <div className="nexora-card p-8 text-center max-w-md mx-auto">
          <ShieldCheck size={24} className="text-zinc-300 mx-auto mb-3" />
          <h1 className="font-prata text-lg text-black mb-1">Access Restricted</h1>
          <p className="text-sm text-zinc-500">Only Super Admin and Admin can view the audit log.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-prata text-2xl text-black">Audit Log</h1>
          <p className="text-zinc-500 text-sm mt-1">{filtered.length} of {entries.length} edits</p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={filtered.length === 0}
          className="nexora-btn nexora-btn-outline self-start sm:self-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={14} /> Download CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="relative flex-1 min-w-[200px] sm:max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            className="nexora-input pl-9"
            placeholder="Search record no. or staff…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="nexora-input w-auto" value={collectionFilter} onChange={(e) => setCollectionFilter(e.target.value)}>
          <option value="">All types</option>
          {COLLECTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="date" aria-label="From date" className="nexora-input w-auto" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} />
        <span className="text-zinc-300 text-xs">–</span>
        <input type="date" aria-label="To date" className="nexora-input w-auto" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} />
        {(fromDate || toDate || search || collectionFilter) && (
          <button
            onClick={() => { setFromDate(""); setToDate(""); setSearch(""); setCollectionFilter(""); }}
            className="nexora-btn nexora-btn-ghost text-xs py-2"
          >
            Clear
          </button>
        )}
      </div>

      <div className="nexora-card overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">When</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Who</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Record</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Fields Changed</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-10 text-zinc-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-zinc-400">No edits recorded</td></tr>
            ) : (
              paginated.map((e) => (
                <tr key={e.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">{formatDate(e.createdAt)}</td>
                  <td className="px-4 py-3 text-zinc-600">{e.performedByName}</td>
                  <td className="px-4 py-3">
                    <span className="badge badge-default">{COLLECTION_LABELS[e.collectionName] || e.collectionName}</span>
                    <span className="ml-2 font-medium text-black">{e.label}</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{e.changes?.map((c: any) => c.field).join(", ")}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setViewEntry(e)} className="nexora-btn nexora-btn-ghost py-1 px-2 text-xs">
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {viewEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 sticky top-0 bg-white flex items-center justify-between">
              <div>
                <h2 className="font-prata text-lg">{COLLECTION_LABELS[viewEntry.collectionName] || viewEntry.collectionName} · {viewEntry.label}</h2>
                <p className="text-xs text-zinc-400 mt-0.5">{viewEntry.performedByName} · {formatDate(viewEntry.createdAt)}</p>
              </div>
              <button onClick={() => setViewEntry(null)} className="text-zinc-400 hover:text-black">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {(viewEntry.changes ?? []).map((c: any, i: number) => (
                <div key={i} className="border border-zinc-100 rounded-lg p-3">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1.5">{c.field}</p>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-red-500 line-through break-all">{String(c.before ?? "—")}</span>
                    <span className="text-zinc-300">→</span>
                    <span className="text-green-700 font-medium break-all">{String(c.after ?? "—")}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
