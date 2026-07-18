"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getStockOuts, getStockOut, adminUpdateStockOut, getJobs } from "@/lib/firestore";
import { useAuth } from "@/hooks/useAuth";
import { Search, Plus, Eye, X, PackageMinus, Download, Pencil } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { rowsToCSV, downloadCSV } from "@/lib/csv";
import SearchableSelect from "@/components/ui/SearchableSelect";

const PAGE_SIZE = 10;

const REASON_LABELS: Record<string, string> = { job: "Job / Repair", sale: "Sale", other: "Other" };

export default function StockOutPage() {
  const { user, userDisplayName, userRole } = useAuth();
  const canManageStock = userRole === "Super Admin" || userRole === "Admin" || userRole === "Manager";
  const canAdminEdit = userRole === "Super Admin" || userRole === "Admin";

  const [stockOuts, setStockOuts] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [viewStockOut, setViewStockOut] = useState<any>(null);

  const [editingStockOut, setEditingStockOut] = useState(false);
  const [editForm, setEditForm] = useState({ recipient: "", reason: "job" as "job" | "sale" | "other", reasonDetail: "", jobId: "", note: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    getStockOuts().then((s) => { setStockOuts(s); setLoading(false); });
    if (canAdminEdit) getJobs().then(setJobs);
  }, [canAdminEdit]);

  useEffect(() => {
    setPage(1);
  }, [search, fromDate, toDate]);

  const openStockOut = async (id: string) => {
    setViewStockOut(await getStockOut(id));
    setEditingStockOut(false);
  };

  const openEditStockOut = () => {
    if (!viewStockOut) return;
    setEditForm({
      recipient: viewStockOut.recipient || "",
      reason: viewStockOut.reason || "job",
      reasonDetail: viewStockOut.reasonDetail || "",
      jobId: viewStockOut.jobId || "",
      note: viewStockOut.note || "",
    });
    setEditingStockOut(true);
  };

  const handleSaveEdit = async () => {
    if (!viewStockOut) return;
    setSavingEdit(true);
    try {
      const job = jobs.find((j) => j.id === editForm.jobId);
      await adminUpdateStockOut(
        viewStockOut.id,
        {
          recipient: editForm.recipient,
          reason: editForm.reason,
          reasonDetail: editForm.reason === "other" ? editForm.reasonDetail : "",
          jobId: editForm.reason === "job" ? editForm.jobId || null : null,
          jobNo: editForm.reason === "job" ? job?.jobNo || null : null,
          note: editForm.note,
        },
        { uid: user!.uid, name: userDisplayName || user?.email || "Admin" }
      );
      setViewStockOut(await getStockOut(viewStockOut.id));
      await getStockOuts().then(setStockOuts);
      setEditingStockOut(false);
    } finally {
      setSavingEdit(false);
    }
  };

  const filtered = stockOuts.filter((s) => {
    const matchesSearch =
      s.stockOutNo?.toLowerCase().includes(search.toLowerCase()) ||
      s.recipient?.toLowerCase().includes(search.toLowerCase()) ||
      s.issuedByName?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (fromDate || toDate) {
      const created = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
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
    const rows = filtered.map((s) => ({
      "Stock Out No.": s.stockOutNo,
      Location: s.location === "showroom" ? "Showroom" : "Stores",
      "Issued By": s.issuedByName,
      Recipient: s.recipient,
      Reason: REASON_LABELS[s.reason] || s.reason,
      "Reason Detail": s.reasonDetail || "",
      Job: s.jobNo || "",
      Note: s.note || "",
      Date: s.createdAt,
    }));
    downloadCSV(`stock-out-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCSV(rows));
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-prata text-2xl text-black">Stock Out</h1>
          <p className="text-zinc-500 text-sm mt-1">{stockOuts.length} issuances recorded</p>
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
            <Link href="/stock-out/new" className="nexora-btn nexora-btn-primary">
              <Plus size={14} /> New Stock Out
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="relative flex-1 min-w-[200px] sm:max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            className="nexora-input pl-9"
            placeholder="Search no., recipient, or staff…"
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
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">No.</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Location</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Issued By</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">To</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Reason</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Date</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-zinc-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-zinc-400">No stock-outs found</td></tr>
            ) : (
              paginated.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-black">{s.stockOutNo}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${s.location === "showroom" ? "badge-success" : "badge-default"}`}>
                      {s.location === "showroom" ? "Showroom" : "Stores"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{s.issuedByName}</td>
                  <td className="px-4 py-3 text-zinc-600">{s.recipient}</td>
                  <td className="px-4 py-3 text-zinc-600">{REASON_LABELS[s.reason] || s.reason}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(s.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => openStockOut(s.id)} className="nexora-btn nexora-btn-ghost py-1 px-2 text-xs">
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

      {viewStockOut && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-zinc-100 sticky top-0 bg-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PackageMinus size={16} className="text-zinc-400" />
                <h2 className="font-prata text-lg">{viewStockOut.stockOutNo}</h2>
              </div>
              <div className="flex items-center gap-2">
                {canAdminEdit && !editingStockOut && (
                  <button onClick={openEditStockOut} className="nexora-btn nexora-btn-ghost py-1 px-2 text-xs">
                    <Pencil size={12} /> Edit
                  </button>
                )}
                <button onClick={() => setViewStockOut(null)} className="text-zinc-400 hover:text-black">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Issued By</p>
                  <p className="text-sm font-medium">{viewStockOut.issuedByName}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Issued To</p>
                  <p className="text-sm font-medium">{viewStockOut.recipient}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Reason</p>
                  <p className="text-sm font-medium">
                    {REASON_LABELS[viewStockOut.reason] || viewStockOut.reason}
                    {viewStockOut.reasonDetail ? ` — ${viewStockOut.reasonDetail}` : ""}
                    {viewStockOut.jobNo ? ` (${viewStockOut.jobNo})` : ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Date</p>
                  <p className="text-sm font-medium">{formatDate(viewStockOut.createdAt)}</p>
                </div>
              </div>

              {editingStockOut ? (
                <div className="nexora-card p-3 mb-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Issued To</label>
                      <input className="nexora-input" value={editForm.recipient} onChange={(e) => setEditForm({ ...editForm, recipient: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Reason</label>
                      <select className="nexora-input" value={editForm.reason} onChange={(e) => setEditForm({ ...editForm, reason: e.target.value as any })}>
                        <option value="job">Job / Repair</option>
                        <option value="sale">Sale</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                  {editForm.reason === "job" && (
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Job</label>
                      <SearchableSelect
                        value={editForm.jobId}
                        onChange={(id) => setEditForm({ ...editForm, jobId: id })}
                        placeholder="Select a job"
                        options={jobs.map((j) => ({ id: j.id, label: `${j.jobNo} — ${j.customerName}`, sublabel: j.customerName }))}
                      />
                    </div>
                  )}
                  {editForm.reason === "other" && (
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Reason Detail</label>
                      <input className="nexora-input" value={editForm.reasonDetail} onChange={(e) => setEditForm({ ...editForm, reasonDetail: e.target.value })} />
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Note</label>
                    <textarea className="nexora-input" rows={2} value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleSaveEdit} disabled={savingEdit} className="nexora-btn nexora-btn-primary text-xs py-1.5 disabled:opacity-60">
                      {savingEdit ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => setEditingStockOut(false)} className="nexora-btn nexora-btn-outline text-xs py-1.5">Cancel</button>
                  </div>
                </div>
              ) : viewStockOut.note ? (
                <p className="text-xs text-zinc-500 mb-4 bg-zinc-50 rounded-lg px-3 py-2">{viewStockOut.note}</p>
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
                    {viewStockOut.items?.map((item: any) => (
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
