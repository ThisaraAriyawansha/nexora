"use client";
import { useEffect, useState, useRef } from "react";
import {
  getProducts, getQuotations, getQuotation, createQuotation,
  updateQuotationStatus, deleteQuotation,
} from "@/lib/firestore";
import type { Product } from "@/types";
import {
  Search, Printer, Eye, X, Plus, Trash2, Check, Ban, FileText, Download,
} from "lucide-react";
import QuotationPrint from "@/components/pos/QuotationPrint";
import { useReactToPrint } from "react-to-print";
import Pagination from "@/components/ui/Pagination";
import { useAuth } from "@/hooks/useAuth";
import { downloadElementAsPdf } from "@/lib/pdf";
import AccessRestricted from "@/components/ui/AccessRestricted";

const PAGE_SIZE = 10;

interface DraftItem {
  tempId: string;
  productId?: string | null;
  productName: string;
  sku?: string;
  qty: number;
  unitPrice: number;
  discount: number;
}

function defaultValidUntil() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

export default function QuotationsPage() {
  const { user, userDisplayName, can } = useAuth();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [validUntil, setValidUntil] = useState(defaultValidUntil());
  const [note, setNote] = useState("");
  const [overallDiscount, setOverallDiscount] = useState(0);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [viewQuotation, setViewQuotation] = useState<any>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ content: () => printRef.current });
  const [downloadingQuotation, setDownloadingQuotation] = useState(false);

  const handleDownloadQuotation = async () => {
    if (!printRef.current || downloadingQuotation) return;
    setDownloadingQuotation(true);
    try {
      await downloadElementAsPdf(printRef.current, `${viewQuotation?.quotationNo || "quotation"}.pdf`);
    } finally {
      setDownloadingQuotation(false);
    }
  };

  const canView = can("quotations.view");
  const canDelete = can("quotations.delete");

  const loadQuotations = () => getQuotations().then((q) => { setQuotations(q); setLoading(false); });

  useEffect(() => {
    if (!canView) { setLoading(false); return; }
    loadQuotations();
    getProducts().then((p) => setProducts(p as Product[]));
  }, [canView]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, fromDate, toDate]);

  const resetForm = () => {
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setValidUntil(defaultValidUntil());
    setNote("");
    setOverallDiscount(0);
    setItems([]);
    setProductSearch("");
    setSaveError("");
  };

  const openCreate = () => {
    resetForm();
    setShowCreate(true);
  };

  const filteredProducts = productSearch
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
          p.sku?.toLowerCase().includes(productSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  const addProductItem = (product: Product) => {
    setItems((prev) => [
      ...prev,
      {
        tempId: `${Date.now()}-${Math.random()}`,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        qty: 1,
        unitPrice: product.sellingPrice || 0,
        discount: 0,
      },
    ]);
    setProductSearch("");
  };

  const addCustomItem = () => {
    setItems((prev) => [
      ...prev,
      { tempId: `${Date.now()}-${Math.random()}`, productId: null, productName: "", qty: 1, unitPrice: 0, discount: 0 },
    ]);
  };

  const updateItem = (tempId: string, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((i) => (i.tempId === tempId ? { ...i, ...patch } : i)));
  };

  const removeItem = (tempId: string) => {
    setItems((prev) => prev.filter((i) => i.tempId !== tempId));
  };

  const lineTotal = (i: DraftItem) => Math.max(0, i.qty * i.unitPrice - i.discount);
  const subtotal = items.reduce((sum, i) => sum + lineTotal(i), 0);
  const totalAmount = Math.max(0, subtotal - overallDiscount);

  const handleCreate = async () => {
    setSaveError("");
    if (items.length === 0) {
      setSaveError("Add at least one item to the quotation.");
      return;
    }
    if (items.some((i) => !i.productName.trim() || i.qty <= 0)) {
      setSaveError("Every item needs a name and a quantity greater than zero.");
      return;
    }
    if (!validUntil) {
      setSaveError("Please set a valid-until date.");
      return;
    }
    setSaving(true);
    try {
      const result = await createQuotation({
        customerId: null,
        customerName: customerName.trim() || "Walk-in Customer",
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        preparedById: user?.uid || "",
        preparedByName: userDisplayName || user?.email || "Staff",
        items: items.map((i) => ({
          productId: i.productId ?? null,
          productName: i.productName.trim(),
          ...(i.sku ? { sku: i.sku } : {}),
          qty: i.qty,
          unitPrice: i.unitPrice,
          discount: i.discount,
          lineTotal: lineTotal(i),
        })),
        subtotal,
        discountAmount: overallDiscount,
        totalAmount,
        validUntil: new Date(`${validUntil}T00:00:00`),
        note: note.trim(),
      });
      await loadQuotations();
      setShowCreate(false);
      const full = await getQuotation(result.quotationId);
      setViewQuotation(full);
    } catch (err: any) {
      setSaveError(err?.message || "Failed to create quotation");
    } finally {
      setSaving(false);
    }
  };

  const openQuotation = async (id: string) => {
    const full = await getQuotation(id);
    setViewQuotation(full);
    setConfirmingDelete(false);
  };

  const closeQuotation = () => {
    setViewQuotation(null);
    setConfirmingDelete(false);
  };

  const changeStatus = async (status: string) => {
    if (!viewQuotation) return;
    setStatusUpdating(true);
    try {
      await updateQuotationStatus(viewQuotation.id, status);
      await loadQuotations();
      const refreshed = await getQuotation(viewQuotation.id);
      setViewQuotation(refreshed);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!viewQuotation) return;
    await deleteQuotation(viewQuotation.id);
    await loadQuotations();
    closeQuotation();
  };

  const filtered = quotations.filter((q) => {
    const matchesSearch =
      q.quotationNo?.toLowerCase().includes(search.toLowerCase()) ||
      q.customerName?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (statusFilter !== "all" && q.status !== statusFilter) return false;

    if (fromDate || toDate) {
      const created = q.createdAt?.toDate ? q.createdAt.toDate() : new Date(q.createdAt);
      if (fromDate && created < new Date(`${fromDate}T00:00:00`)) return false;
      if (toDate && created > new Date(`${toDate}T23:59:59.999`)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filteredTotal = filtered.reduce((sum, q) => sum + (q.totalAmount || 0), 0);

  const formatDate = (ts: any) => {
    if (!ts) return "—";
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  };

  const statusBadge = (status: string) => {
    const cls =
      status === "accepted" || status === "converted" ? "badge-success" :
      status === "rejected" || status === "expired" ? "badge-danger" :
      "badge-default";
    return <span className={`badge ${cls} capitalize`}>{status}</span>;
  };

  if (!canView) return <AccessRestricted message="You don't have permission to view Quotations." />;

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-prata text-2xl text-black">Quotations</h1>
          <p className="text-zinc-500 text-sm mt-1">{quotations.length} total quotations</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="sm:text-right">
            <p className="text-xs text-zinc-400 uppercase tracking-wider">Total · {filtered.length} quotations</p>
            <p className="font-poppins font-semibold text-xl text-black">Rs. {filteredTotal.toLocaleString()}</p>
          </div>
          <button onClick={openCreate} className="nexora-btn nexora-btn-primary text-sm">
            <Plus size={14} /> New Quotation
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="relative flex-1 min-w-[200px] sm:max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            className="nexora-input pl-9"
            placeholder="Search quotation no. or customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Filter by status"
          className="nexora-input w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
          <option value="converted">Converted</option>
        </select>
        <input
          type="date"
          aria-label="From date"
          className="nexora-input w-auto"
          value={fromDate}
          max={toDate || undefined}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <span className="text-zinc-300 text-xs">–</span>
        <input
          type="date"
          aria-label="To date"
          className="nexora-input w-auto"
          value={toDate}
          min={fromDate || undefined}
          onChange={(e) => setToDate(e.target.value)}
        />
        {(statusFilter !== "all" || fromDate || toDate) && (
          <button
            onClick={() => { setStatusFilter("all"); setFromDate(""); setToDate(""); }}
            className="nexora-btn nexora-btn-ghost text-xs py-2"
          >
            Clear
          </button>
        )}
      </div>

      <div className="nexora-card overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Quotation</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Customer</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Issued</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Valid Until</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Total</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-zinc-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-zinc-400">No quotations found</td></tr>
            ) : (
              paginated.map((q) => (
                <tr key={q.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-black">{q.quotationNo}</td>
                  <td className="px-4 py-3 text-zinc-600">{q.customerName || "Walk-in"}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(q.createdAt)}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(q.validUntil)}</td>
                  <td className="px-4 py-3 font-medium text-black">Rs. {q.totalAmount?.toLocaleString()}</td>
                  <td className="px-4 py-3">{statusBadge(q.status)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => openQuotation(q.id)} className="nexora-btn nexora-btn-ghost py-1 px-2 text-xs">
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

      {/* Create quotation modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-zinc-100 sticky top-0 z-20 bg-white flex items-center justify-between">
              <h2 className="font-prata text-lg flex items-center gap-2"><FileText size={16} /> New Quotation</h2>
              <button onClick={() => setShowCreate(false)} className="text-zinc-400 hover:text-black">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-4 space-y-5">
              {/* Customer details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Customer Name</label>
                  <input className="nexora-input" placeholder="Walk-in Customer" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Phone</label>
                  <input className="nexora-input" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Address</label>
                  <input className="nexora-input" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
                </div>
              </div>

              {/* Product search */}
              <div>
                <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Add Item</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    className="nexora-input pl-9"
                    placeholder="Search products by name or SKU…"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                  {filteredProducts.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-zinc-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                      {filteredProducts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => addProductItem(p)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 flex items-center justify-between"
                        >
                          <span>
                            <span className="font-medium">{p.name}</span>
                            <span className="text-zinc-400 text-xs ml-2">{p.sku}</span>
                          </span>
                          <span className="text-zinc-500 text-xs">Rs. {p.sellingPrice?.toLocaleString()}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" onClick={addCustomItem} className="nexora-btn nexora-btn-ghost text-xs mt-2">
                  <Plus size={12} /> Add custom line item
                </button>
              </div>

              {/* Item rows */}
              {items.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead>
                      <tr className="border-b border-zinc-100">
                        <th className="text-left py-2 text-xs text-zinc-500 font-medium">Item</th>
                        <th className="text-center py-2 text-xs text-zinc-500 font-medium w-20">Qty</th>
                        <th className="text-right py-2 text-xs text-zinc-500 font-medium w-28">Unit Price</th>
                        <th className="text-right py-2 text-xs text-zinc-500 font-medium w-24">Discount</th>
                        <th className="text-right py-2 text-xs text-zinc-500 font-medium w-28">Total</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {items.map((i) => (
                        <tr key={i.tempId}>
                          <td className="py-2 pr-2">
                            <input
                              className="nexora-input py-1.5 text-sm"
                              placeholder="Item name"
                              value={i.productName}
                              onChange={(e) => updateItem(i.tempId, { productName: e.target.value })}
                            />
                          </td>
                          <td className="py-2 px-1">
                            <input
                              type="number"
                              min={1}
                              className="nexora-input py-1.5 text-sm text-center"
                              value={i.qty}
                              onChange={(e) => updateItem(i.tempId, { qty: Number(e.target.value) })}
                            />
                          </td>
                          <td className="py-2 px-1">
                            <input
                              type="number"
                              min={0}
                              className="nexora-input py-1.5 text-sm text-right"
                              value={i.unitPrice}
                              onChange={(e) => updateItem(i.tempId, { unitPrice: Number(e.target.value) })}
                            />
                          </td>
                          <td className="py-2 px-1">
                            <input
                              type="number"
                              min={0}
                              className="nexora-input py-1.5 text-sm text-right"
                              value={i.discount || ""}
                              placeholder="0"
                              onChange={(e) => updateItem(i.tempId, { discount: Number(e.target.value) || 0 })}
                            />
                          </td>
                          <td className="py-2 pl-1 text-right font-medium whitespace-nowrap">Rs. {lineTotal(i).toLocaleString()}</td>
                          <td className="py-2 pl-1 text-right">
                            <button onClick={() => removeItem(i.tempId)} className="text-zinc-400 hover:text-red-600">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Valid until, discount, note */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Valid Until</label>
                  <input type="date" className="nexora-input" value={validUntil} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setValidUntil(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Overall Discount (Rs.)</label>
                  <input
                    type="number"
                    min={0}
                    className="nexora-input"
                    value={overallDiscount || ""}
                    placeholder="0"
                    onChange={(e) => setOverallDiscount(Number(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Note / Terms</label>
                <textarea className="nexora-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>

              {/* Totals */}
              <div className="border-t border-zinc-100 pt-4 space-y-1.5">
                <div className="flex justify-between text-sm text-zinc-500">
                  <span>Subtotal</span><span>Rs. {subtotal.toLocaleString()}</span>
                </div>
                {overallDiscount > 0 && (
                  <div className="flex justify-between text-sm text-red-500">
                    <span>Discount</span><span>- Rs. {overallDiscount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-prata text-lg border-t border-zinc-100 pt-2 mt-2">
                  <span>Total</span><span>Rs. {totalAmount.toLocaleString()}</span>
                </div>
              </div>

              {saveError && <p className="text-sm text-red-600">{saveError}</p>}

              <div className="flex gap-2 pb-2">
                <button onClick={handleCreate} disabled={saving} className="nexora-btn nexora-btn-primary text-sm disabled:opacity-50">
                  {saving ? "Saving…" : "Save Quotation"}
                </button>
                <button onClick={() => setShowCreate(false)} className="nexora-btn nexora-btn-ghost text-sm" disabled={saving}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quotation detail modal */}
      {viewQuotation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-zinc-100 sticky top-0 z-20 bg-white">
              <div className="flex items-center justify-between">
                <h2 className="font-prata text-lg">{viewQuotation.quotationNo}</h2>
                <button onClick={closeQuotation} className="text-zinc-400 hover:text-black">
                  <X size={18} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <button onClick={handlePrint} className="nexora-btn nexora-btn-outline text-sm">
                  <Printer size={14} /> Print A4
                </button>
                <button onClick={handleDownloadQuotation} disabled={downloadingQuotation} className="nexora-btn nexora-btn-outline text-sm">
                  <Download size={14} /> {downloadingQuotation ? "Downloading…" : "Download"}
                </button>
                {viewQuotation.status === "sent" && (
                  <>
                    <button
                      onClick={() => changeStatus("accepted")}
                      disabled={statusUpdating}
                      className="nexora-btn nexora-btn-outline text-sm text-green-700 border-green-200 hover:bg-green-50"
                    >
                      <Check size={14} /> Mark Accepted
                    </button>
                    <button
                      onClick={() => changeStatus("rejected")}
                      disabled={statusUpdating}
                      className="nexora-btn nexora-btn-outline text-sm text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Ban size={14} /> Mark Rejected
                    </button>
                  </>
                )}
                {canDelete && (
                  <button
                    onClick={() => setConfirmingDelete(true)}
                    className="nexora-btn nexora-btn-ghost text-sm text-red-600"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                )}
              </div>
            </div>

            {confirmingDelete && (
              <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-sm">
                <p className="font-medium text-amber-800 mb-2">Delete this quotation permanently? This cannot be undone.</p>
                <div className="flex gap-2">
                  <button onClick={handleDelete} className="nexora-btn nexora-btn-danger text-sm">Confirm Delete</button>
                  <button onClick={() => setConfirmingDelete(false)} className="nexora-btn nexora-btn-ghost text-sm">Back</button>
                </div>
              </div>
            )}

            <div className="px-6 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Customer</p>
                  <p className="text-sm font-medium truncate">{viewQuotation.customerName || "Walk-in"}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Valid Until</p>
                  <p className="text-sm font-medium">{formatDate(viewQuotation.validUntil)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Status</p>
                  {statusBadge(viewQuotation.status)}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm mb-4 min-w-[480px]">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      <th className="text-left py-2 text-xs text-zinc-500 font-medium">Item</th>
                      <th className="text-center py-2 text-xs text-zinc-500 font-medium">Qty</th>
                      <th className="text-right py-2 text-xs text-zinc-500 font-medium">Price</th>
                      <th className="text-right py-2 text-xs text-zinc-500 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {viewQuotation.items?.map((item: any, i: number) => (
                      <tr key={i}>
                        <td className="py-2.5">
                          <p className="font-medium text-black">{item.productName}</p>
                          {item.sku && <p className="text-xs text-zinc-400">{item.sku}</p>}
                        </td>
                        <td className="py-2.5 text-center">{item.qty}</td>
                        <td className="py-2.5 text-right">Rs. {item.unitPrice?.toLocaleString()}</td>
                        <td className="py-2.5 text-right font-medium">Rs. {item.lineTotal?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-zinc-100 pt-4 space-y-1.5">
                <div className="flex justify-between text-sm text-zinc-500">
                  <span>Subtotal</span><span>Rs. {viewQuotation.subtotal?.toLocaleString()}</span>
                </div>
                {viewQuotation.discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-red-500">
                    <span>Discount</span><span>- Rs. {viewQuotation.discountAmount?.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-prata text-lg border-t border-zinc-100 pt-2 mt-2">
                  <span>Total</span><span>Rs. {viewQuotation.totalAmount?.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Off-screen print/PDF area (kept out of view but still rendered so html2canvas can capture it) */}
      <div style={{ position: "fixed", top: 0, left: "-10000px", zIndex: -1 }}>
        <div ref={printRef}>
          {viewQuotation && <QuotationPrint quotation={viewQuotation} />}
        </div>
      </div>
    </div>
  );
}
