"use client";
import { useEffect, useState, useRef } from "react";
import { getSale, getSales } from "@/lib/firestore";
import { Search, Printer, Eye, X } from "lucide-react";
import BillPrint from "@/components/pos/BillPrint";
import { useReactToPrint } from "react-to-print";

export default function BillsPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [viewSale, setViewSale] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ content: () => printRef.current });

  useEffect(() => {
    getSales().then((s) => { setSales(s); setLoading(false); });
  }, []);

  const openSale = async (id: string) => {
    const full = await getSale(id);
    setViewSale(full);
  };

  const filtered = sales.filter(
    (s) =>
      s.invoiceNo?.toLowerCase().includes(search.toLowerCase()) ||
      s.customerName?.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (ts: any) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-prata text-2xl text-black">Bills</h1>
          <p className="text-zinc-500 text-sm mt-1">{sales.length} total invoices</p>
        </div>
      </div>

      <div className="relative mb-6 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          className="nexora-input pl-9"
          placeholder="Search invoice no. or customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="nexora-card overflow-hidden">
        <table className="w-full text-sm">
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
              filtered.map((sale) => (
                <tr key={sale.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-black">{sale.invoiceNo}</td>
                  <td className="px-4 py-3 text-zinc-600">{sale.customerName || "Walk-in"}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(sale.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className="badge badge-default capitalize">{sale.paymentMethod}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-black">Rs. {sale.totalAmount?.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${sale.paymentStatus === "paid" ? "badge-success" : sale.paymentStatus === "partial" ? "badge-warning" : "badge-danger"}`}>
                      {sale.paymentStatus}
                    </span>
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

      {/* Bill detail modal */}
      {viewSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 sticky top-0 bg-white">
              <h2 className="font-prata text-lg">{viewSale.invoiceNo}</h2>
              <div className="flex gap-2">
                <button onClick={handlePrint} className="nexora-btn nexora-btn-outline text-sm">
                  <Printer size={14} /> Print A4
                </button>
                <button onClick={() => setViewSale(null)} className="text-zinc-400 hover:text-black ml-2">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="px-6 py-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Customer</p>
                  <p className="text-sm font-medium">{viewSale.customerName || "Walk-in"}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Cashier</p>
                  <p className="text-sm font-medium">{viewSale.cashierName}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Payment</p>
                  <p className="text-sm font-medium capitalize">{viewSale.paymentMethod}</p>
                </div>
              </div>

              {/* Items */}
              <table className="w-full text-sm mb-4">
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
                <div className="flex justify-between font-prata text-lg border-t border-zinc-100 pt-2 mt-2">
                  <span>Total</span><span>Rs. {viewSale.totalAmount?.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden print */}
      <div className="hidden">
        <div ref={printRef}>
          {viewSale && <BillPrint sale={viewSale} />}
        </div>
      </div>
    </div>
  );
}
