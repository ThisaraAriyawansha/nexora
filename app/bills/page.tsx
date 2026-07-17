"use client";
import { useEffect, useState, useRef } from "react";
import { getSale, getSales, cancelSale } from "@/lib/firestore";
import { Search, Printer, Eye, X, Ban, Download, Mail } from "lucide-react";
import BillPrint from "@/components/pos/BillPrint";
import { useReactToPrint } from "react-to-print";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/hooks/useAuth";
import { downloadElementAsPdf, getElementPdfBase64 } from "@/lib/pdf";

const PAGE_SIZE = 10;

export default function BillsPage() {
  const { user, userRole, userDisplayName } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [viewSale, setViewSale] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ content: () => printRef.current });
  const [downloadingBill, setDownloadingBill] = useState(false);

  const [confirmingEmailBill, setConfirmingEmailBill] = useState(false);
  const [sendingBillEmail, setSendingBillEmail] = useState(false);
  const [billEmailNotice, setBillEmailNotice] = useState("");

  const handleDownloadBill = async () => {
    if (!printRef.current || downloadingBill) return;
    setDownloadingBill(true);
    try {
      await downloadElementAsPdf(printRef.current, `${viewSale?.invoiceNo || "invoice"}.pdf`);
    } finally {
      setDownloadingBill(false);
    }
  };

  const handleSendBillEmail = async () => {
    if (!printRef.current || !viewSale?.customerEmail || sendingBillEmail) return;
    setSendingBillEmail(true);
    setBillEmailNotice("");
    try {
      const [pdfBase64, idToken] = await Promise.all([
        getElementPdfBase64(printRef.current),
        user!.getIdToken(),
      ]);
      const res = await fetch("/api/bills/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          customerEmail: viewSale.customerEmail,
          customerName: viewSale.customerName,
          invoiceNo: viewSale.invoiceNo,
          items: viewSale.items?.map((i: any) => ({ productName: i.productName, qty: i.qty, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
          subtotal: viewSale.subtotal,
          discountAmount: viewSale.discountAmount,
          totalAmount: viewSale.totalAmount,
          paymentMethod: viewSale.paymentMethod,
          pdfBase64,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send email");
      setBillEmailNotice(`Emailed ${viewSale.customerEmail}.`);
    } catch (err: any) {
      setBillEmailNotice(err?.message || "Failed to send email.");
    } finally {
      setSendingBillEmail(false);
      setConfirmingEmailBill(false);
    }
  };

  const canCancelBills = userRole === "Super Admin" || userRole === "Admin";

  const loadSales = () => getSales().then((s) => { setSales(s); setLoading(false); });

  useEffect(() => {
    loadSales();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, fromDate, toDate]);

  const openSale = async (id: string) => {
    const full = await getSale(id);
    setViewSale(full);
    setConfirmingCancel(false);
    setCancelReason("");
    setCancelError("");
    setBillEmailNotice("");
  };

  const closeSale = () => {
    setViewSale(null);
    setConfirmingCancel(false);
    setCancelReason("");
    setCancelError("");
  };

  const handleCancelSale = async () => {
    if (!viewSale || !cancelReason.trim()) return;
    setCancelling(true);
    setCancelError("");
    try {
      await cancelSale(
        viewSale.id,
        { uid: user!.uid, name: userDisplayName || user?.email || "Admin" },
        cancelReason.trim()
      );
      await loadSales();
      const refreshed = await getSale(viewSale.id);
      setViewSale(refreshed);
      setConfirmingCancel(false);
      setCancelReason("");
    } catch (err: any) {
      setCancelError(err?.message || "Failed to cancel bill");
    } finally {
      setCancelling(false);
    }
  };

  const filtered = sales.filter((s) => {
    const matchesSearch =
      s.invoiceNo?.toLowerCase().includes(search.toLowerCase()) ||
      s.customerName?.toLowerCase().includes(search.toLowerCase());
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
  const filteredTotal = filtered
    .filter((s) => s.status !== "cancelled")
    .reduce((sum, s) => sum + (s.totalAmount || 0), 0);

  const formatDate = (ts: any) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-prata text-2xl text-black">Bills</h1>
          <p className="text-zinc-500 text-sm mt-1">{sales.length} total invoices</p>
        </div>
        <div className="sm:text-right">
          <p className="text-xs text-zinc-400 uppercase tracking-wider">Total · {filtered.length} invoices</p>
          <p className="font-poppins font-semibold text-xl text-black">Rs. {filteredTotal.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="relative flex-1 min-w-[200px] sm:max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            className="nexora-input pl-9"
            placeholder="Search invoice no. or customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
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
        {(fromDate || toDate) && (
          <button
            onClick={() => { setFromDate(""); setToDate(""); }}
            className="nexora-btn nexora-btn-ghost text-xs py-2"
          >
            Clear
          </button>
        )}
      </div>

      <div className="nexora-card overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Invoice</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Customer</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Date</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Payment</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Total</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-zinc-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-zinc-400">No bills found</td></tr>
            ) : (
              paginated.map((sale) => (
                <tr key={sale.id} className={`hover:bg-zinc-50 transition-colors ${sale.status === "cancelled" ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 font-medium text-black">{sale.invoiceNo}</td>
                  <td className="px-4 py-3 text-zinc-600">{sale.customerName || "Walk-in"}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(sale.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className="badge badge-default capitalize">{sale.paymentMethod}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-black">Rs. {sale.totalAmount?.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {sale.status === "cancelled" ? (
                      <span className="badge badge-danger">Cancelled</span>
                    ) : (
                      <span className={`badge ${sale.paymentStatus === "paid" ? "badge-success" : sale.paymentStatus === "partial" ? "badge-warning" : "badge-danger"}`}>
                        {sale.paymentStatus}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openSale(sale.id)} className="nexora-btn nexora-btn-ghost py-1 px-2 text-xs">
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

      {/* Bill detail modal */}
      {viewSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-zinc-100 sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <h2 className="font-prata text-lg">{viewSale.invoiceNo}</h2>
                <button onClick={closeSale} className="text-zinc-400 hover:text-black">
                  <X size={18} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <button onClick={handlePrint} className="nexora-btn nexora-btn-outline text-sm">
                  <Printer size={14} /> Print A4
                </button>
                <button onClick={handleDownloadBill} disabled={downloadingBill} className="nexora-btn nexora-btn-outline text-sm">
                  <Download size={14} /> {downloadingBill ? "Downloading…" : "Download"}
                </button>
                {viewSale.customerEmail && (
                  <button onClick={() => { setBillEmailNotice(""); setConfirmingEmailBill(true); }} className="nexora-btn nexora-btn-outline text-sm">
                    <Mail size={14} /> Send Mail
                  </button>
                )}
                {canCancelBills && viewSale.status !== "cancelled" && (
                  <button
                    onClick={() => setConfirmingCancel(true)}
                    className="nexora-btn nexora-btn-outline text-sm text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <Ban size={14} /> Reverse Bill
                  </button>
                )}
              </div>
            </div>

            {billEmailNotice && (
              <div className="mx-6 mt-4 px-4 py-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-sm text-zinc-600 flex items-center justify-between">
                <span>{billEmailNotice}</span>
                <button onClick={() => setBillEmailNotice("")} className="text-zinc-400 hover:text-black"><X size={14} /></button>
              </div>
            )}

            {viewSale.status === "cancelled" && (
              <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
                <p className="font-medium">This bill has been reversed.</p>
                <p className="text-xs text-red-500 mt-0.5">
                  By {viewSale.cancelledByName || "—"} on {formatDate(viewSale.cancelledAt)}
                  {viewSale.cancelReason ? ` — ${viewSale.cancelReason}` : ""}
                </p>
              </div>
            )}

            {confirmingCancel && (
              <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-sm">
                <p className="font-medium text-amber-800 mb-2">
                  Reversing this bill restores the sold quantities back to stock and cancels any warranty/loyalty points it created. This cannot be undone. Are you sure?
                </p>
                <textarea
                  className="nexora-input w-full text-sm mb-2"
                  rows={2}
                  placeholder="Reason for reversing this bill (required)…"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
                {cancelError && <p className="text-xs text-red-600 mb-2">{cancelError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelSale}
                    disabled={!cancelReason.trim() || cancelling}
                    className="nexora-btn nexora-btn-danger text-sm disabled:opacity-50"
                  >
                    {cancelling ? "Reversing…" : "Confirm Reverse"}
                  </button>
                  <button
                    onClick={() => { setConfirmingCancel(false); setCancelReason(""); setCancelError(""); }}
                    className="nexora-btn nexora-btn-ghost text-sm"
                    disabled={cancelling}
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            <div className="px-6 py-4">
              {/* Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Customer</p>
                  <p className="text-sm font-medium truncate">{viewSale.customerName || "Walk-in"}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Cashier</p>
                  <p className="text-sm font-medium break-all">{viewSale.cashierName?.includes("@") ? "Cashier" : viewSale.cashierName}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Payment</p>
                  <p className="text-sm font-medium capitalize">{viewSale.paymentMethod}</p>
                </div>
              </div>

              {/* Items */}
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
                  {viewSale.items?.map((item: any, i: number) => (
                    <tr key={i}>
                      <td className="py-2.5">
                        <p className="font-medium text-black">{item.productName}</p>
                        <p className="text-xs text-zinc-400">{item.sku}</p>
                      </td>
                      <td className="py-2.5 text-center">{item.qty}</td>
                      <td className="py-2.5 text-right">Rs. {item.unitPrice?.toLocaleString()}</td>
                      <td className="py-2.5 text-right font-medium">Rs. {item.lineTotal?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

              {/* Totals */}
              <div className="border-t border-zinc-100 pt-4 space-y-1.5">
                <div className="flex justify-between text-sm text-zinc-500">
                  <span>Subtotal</span><span>Rs. {viewSale.subtotal?.toLocaleString()}</span>
                </div>
                {viewSale.discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-red-500">
                    <span>Discount</span><span>- Rs. {viewSale.discountAmount?.toLocaleString()}</span>
                  </div>
                )}
                {viewSale.pointsRedeemed > 0 && (
                  <div className="flex justify-between text-sm text-violet-600">
                    <span>Points Redeemed ({viewSale.pointsRedeemed} pts)</span>
                    <span>- Rs. {viewSale.pointsRedeemed?.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-prata text-lg border-t border-zinc-100 pt-2 mt-2">
                  <span>Total</span><span>Rs. {viewSale.totalAmount?.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Off-screen print/PDF area (kept out of view but still rendered so html2canvas can capture it) */}
      <div style={{ position: "fixed", top: 0, left: "-10000px", zIndex: -1 }}>
        <div ref={printRef}>
          {viewSale && <BillPrint sale={viewSale} />}
        </div>
      </div>

      <ConfirmDialog
        open={confirmingEmailBill}
        title="Email the receipt?"
        message={`Send this bill by email to ${viewSale?.customerEmail} with the PDF invoice attached?`}
        confirmText="Send Email"
        loadingText="Sending…"
        cancelText="Cancel"
        danger={false}
        loading={sendingBillEmail}
        onConfirm={handleSendBillEmail}
        onCancel={() => setConfirmingEmailBill(false)}
      />
    </div>
  );
}
