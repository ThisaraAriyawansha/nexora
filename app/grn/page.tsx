"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getGrns, getGrn, adminUpdateGrn, getSuppliers } from "@/lib/firestore";
import { useAuth } from "@/hooks/useAuth";
import { Search, Plus, Eye, X, PackagePlus, Download, Pencil } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { rowsToCSV, downloadCSV } from "@/lib/csv";
import SearchableSelect from "@/components/ui/SearchableSelect";

const PAGE_SIZE = 10;

export default function GrnPage() {
  const { user, userDisplayName, userRole } = useAuth();
  const canManageStock = userRole === "Super Admin" || userRole === "Admin" || userRole === "Manager";
  const canAdminEdit = userRole === "Super Admin" || userRole === "Admin";

  const [grns, setGrns] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [viewGrn, setViewGrn] = useState<any>(null);

  const [editingGrn, setEditingGrn] = useState(false);
  const [editSupplierId, setEditSupplierId] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editItems, setEditItems] = useState<{ id: string; costPrice: string; sellingPrice: string }[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    getGrns().then((g) => { setGrns(g); setLoading(false); });
    if (canAdminEdit) getSuppliers().then(setSuppliers);
  }, [canAdminEdit]);

  useEffect(() => {
    setPage(1);
  }, [search, fromDate, toDate]);

  const openGrn = async (id: string) => {
    setViewGrn(await getGrn(id));
    setEditingGrn(false);
  };

  const openEditGrn = () => {
    if (!viewGrn) return;
    setEditSupplierId(viewGrn.supplierId || "");
    setEditNote(viewGrn.note || "");
    setEditItems((viewGrn.items || []).map((i: any) => ({ id: i.id, costPrice: String(i.costPrice), sellingPrice: i.sellingPrice != null ? String(i.sellingPrice) : "" })));
    setEditingGrn(true);
  };

  const handleSaveGrnEdit = async () => {
    if (!viewGrn) return;
    setSavingEdit(true);
    try {
      const supplier = suppliers.find((s) => s.id === editSupplierId);
      await adminUpdateGrn(
        viewGrn.id,
        {
          supplierId: editSupplierId || null,
          supplierName: supplier?.name || "",
          note: editNote,
          items: editItems.map((i) => ({
            id: i.id,
            costPrice: Number(i.costPrice),
            sellingPrice: i.sellingPrice ? Number(i.sellingPrice) : null,
          })),
        },
        { uid: user!.uid, name: userDisplayName || user?.email || "Admin" }
      );
      setViewGrn(await getGrn(viewGrn.id));
      await getGrns().then(setGrns);
      setEditingGrn(false);
    } finally {
      setSavingEdit(false);
    }
  };

  const filtered = grns.filter((g) => {
    const matchesSearch =
      g.grnNo?.toLowerCase().includes(search.toLowerCase()) ||
      g.supplierName?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (fromDate || toDate) {
      const created = g.createdAt?.toDate ? g.createdAt.toDate() : new Date(g.createdAt);
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
    const rows = filtered.map((g) => ({
      "GRN No.": g.grnNo,
      Supplier: g.supplierName || "",
      "Received By": g.receivedByName,
      "Total Cost": g.totalCost ?? "",
      Note: g.note || "",
      Date: g.createdAt,
    }));
    downloadCSV(`grn-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCSV(rows));
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-prata text-2xl text-black">GRN — Goods Received</h1>
          <p className="text-zinc-500 text-sm mt-1">{grns.length} notes recorded</p>
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
            <Link href="/grn/new" className="nexora-btn nexora-btn-primary">
              <Plus size={14} /> New GRN
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="relative flex-1 min-w-[200px] sm:max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            className="nexora-input pl-9"
            placeholder="Search GRN no. or supplier…"
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
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">GRN No.</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Supplier</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Received By</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Total Cost</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Date</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-zinc-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-zinc-400">No GRNs found</td></tr>
            ) : (
              paginated.map((g) => (
                <tr key={g.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-black">{g.grnNo}</td>
                  <td className="px-4 py-3 text-zinc-600">{g.supplierName || "—"}</td>
                  <td className="px-4 py-3 text-zinc-600">{g.receivedByName}</td>
                  <td className="px-4 py-3 font-medium text-black">Rs. {g.totalCost?.toLocaleString() ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(g.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => openGrn(g.id)} className="nexora-btn nexora-btn-ghost py-1 px-2 text-xs">
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

      {viewGrn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-zinc-100 sticky top-0 bg-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PackagePlus size={16} className="text-zinc-400" />
                <h2 className="font-prata text-lg">{viewGrn.grnNo}</h2>
              </div>
              <div className="flex items-center gap-2">
                {canAdminEdit && !editingGrn && (
                  <button onClick={openEditGrn} className="nexora-btn nexora-btn-ghost py-1 px-2 text-xs">
                    <Pencil size={12} /> Edit
                  </button>
                )}
                <button onClick={() => setViewGrn(null)} className="text-zinc-400 hover:text-black">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="px-6 py-4">
              {editingGrn ? (
                <div className="nexora-card p-3 mb-4 space-y-3">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Supplier</label>
                    <SearchableSelect
                      value={editSupplierId}
                      onChange={setEditSupplierId}
                      placeholder="No supplier"
                      options={suppliers.map((s) => ({ id: s.id, label: s.name }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Note</label>
                    <textarea className="nexora-input" rows={2} value={editNote} onChange={(e) => setEditNote(e.target.value)} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Items (quantity locked)</p>
                    <div className="space-y-2">
                      {(viewGrn.items || []).map((item: any, i: number) => (
                        <div key={item.id} className="grid grid-cols-3 gap-2 items-center">
                          <span className="text-sm text-black truncate">{item.productName} <span className="text-xs text-zinc-400">· Qty {item.qty}</span></span>
                          <input
                            type="number"
                            className="nexora-input text-sm"
                            value={editItems[i]?.costPrice ?? ""}
                            placeholder="Cost"
                            onChange={(e) => setEditItems((prev) => prev.map((p, idx) => idx === i ? { ...p, costPrice: e.target.value } : p))}
                          />
                          <input
                            type="number"
                            className="nexora-input text-sm"
                            value={editItems[i]?.sellingPrice ?? ""}
                            placeholder="Sells"
                            onChange={(e) => setEditItems((prev) => prev.map((p, idx) => idx === i ? { ...p, sellingPrice: e.target.value } : p))}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleSaveGrnEdit} disabled={savingEdit} className="nexora-btn nexora-btn-primary text-xs py-1.5 disabled:opacity-60">
                      {savingEdit ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => setEditingGrn(false)} className="nexora-btn nexora-btn-outline text-xs py-1.5">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Supplier</p>
                      <p className="text-sm font-medium">{viewGrn.supplierName || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Received By</p>
                      <p className="text-sm font-medium">{viewGrn.receivedByName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Date</p>
                      <p className="text-sm font-medium">{formatDate(viewGrn.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Total Cost</p>
                      <p className="text-sm font-medium">Rs. {viewGrn.totalCost?.toLocaleString() ?? "—"}</p>
                    </div>
                  </div>
                  {viewGrn.note && (
                    <p className="text-xs text-zinc-500 mb-4 bg-zinc-50 rounded-lg px-3 py-2">{viewGrn.note}</p>
                  )}
                </>
              )}
              {!editingGrn && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      <th className="text-left py-2 text-xs text-zinc-500 font-medium">Item</th>
                      <th className="text-center py-2 text-xs text-zinc-500 font-medium">Qty</th>
                      <th className="text-right py-2 text-xs text-zinc-500 font-medium">Cost</th>
                      <th className="text-right py-2 text-xs text-zinc-500 font-medium">Sells</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {viewGrn.items?.map((item: any) => (
                      <tr key={item.id}>
                        <td className="py-2.5">
                          <p className="font-medium text-black">{item.productName}</p>
                          <p className="text-xs text-zinc-400">{item.sku}</p>
                          {item.serials?.length > 0 && (
                            <p className="text-xs text-zinc-400 font-mono mt-0.5">{item.serials.join(", ")}</p>
                          )}
                        </td>
                        <td className="py-2.5 text-center">{item.qty}</td>
                        <td className="py-2.5 text-right">Rs. {item.costPrice?.toLocaleString()}</td>
                        <td className="py-2.5 text-right">{item.sellingPrice != null ? `Rs. ${item.sellingPrice.toLocaleString()}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
