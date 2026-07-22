"use client";
import { useEffect, useState } from "react";
import { getStockMovements, getProducts } from "@/lib/firestore";
import { Search, Download } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { rowsToCSV, downloadCSV } from "@/lib/csv";
import { useAuth } from "@/hooks/useAuth";
import AccessRestricted from "@/components/ui/AccessRestricted";

const PAGE_SIZE = 20;

const TYPE_BADGE: Record<string, string> = {
  in: "badge-success",
  out: "badge-danger",
  adjustment: "badge-warning",
  transfer: "badge-default",
};

const REFERENCE_TYPE_OPTIONS = [
  { value: "grn", label: "GRN" },
  { value: "transfer", label: "Transfer" },
  { value: "stock_out", label: "Stock Out" },
  { value: "sale", label: "Sale" },
  { value: "sale_cancel", label: "Sale Cancel" },
  { value: "batch_edit", label: "Batch Edit" },
];

function locationLabel(loc?: string) {
  if (!loc) return "—";
  return loc === "showroom" ? "Showroom" : "Stores";
}

export default function StockMovementsPage() {
  const { can } = useAuth();
  const canView = can("stockMovements.view");
  const [movements, setMovements] = useState<any[]>([]);
  const [products, setProducts] = useState<Map<string, { name: string; sku: string }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [activeTypes, setActiveTypes] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!canView) { setLoading(false); return; }
    Promise.all([getStockMovements(), getProducts()]).then(([m, p]) => {
      setMovements(m);
      setProducts(new Map((p as any[]).map((prod) => [prod.id, { name: prod.name, sku: prod.sku }])));
      setLoading(false);
    });
  }, [canView]);

  useEffect(() => {
    setPage(1);
  }, [search, fromDate, toDate, activeTypes]);

  const toggleType = (value: string) => {
    setActiveTypes((types) => (types.includes(value) ? types.filter((t) => t !== value) : [...types, value]));
  };

  const filtered = movements.filter((m) => {
    const product = products.get(m.productId);
    const matchesSearch =
      !search ||
      product?.name?.toLowerCase().includes(search.toLowerCase()) ||
      product?.sku?.toLowerCase().includes(search.toLowerCase()) ||
      m.note?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (activeTypes.length > 0 && !activeTypes.includes(m.referenceType)) return false;

    if (fromDate || toDate) {
      const created = m.createdAt?.toDate ? m.createdAt.toDate() : new Date(m.createdAt);
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
    const rows = filtered.map((m) => {
      const product = products.get(m.productId);
      return {
        Date: m.createdAt,
        Type: m.type,
        Product: product?.name || "",
        SKU: product?.sku || "",
        Qty: m.qty,
        Location: m.type === "transfer" ? `${locationLabel(m.fromLocation)} → ${locationLabel(m.toLocation)}` : locationLabel(m.location),
        By: m.performedByName || m.performedBy,
        Recipient: m.recipient || "",
        Reason: m.reason ? (m.reason === "job" ? "Job/Repair" : m.reason === "sale" ? "Sale" : m.reasonDetail || "Other") : "",
        Reference: m.note || "",
      };
    });
    downloadCSV(`stock-movements-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCSV(rows));
  };

  if (!canView) return <AccessRestricted message="You don't have permission to view Stock Movements." />;

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-prata text-2xl text-black">Stock Movements</h1>
          <p className="text-zinc-500 text-sm mt-1">{filtered.length} of {movements.length} movements</p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={filtered.length === 0}
          className="nexora-btn nexora-btn-outline self-start sm:self-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={14} /> Download CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] sm:max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            className="nexora-input pl-9"
            placeholder="Search product, SKU, or reference…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <input type="date" aria-label="From date" className="nexora-input w-auto" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} />
        <span className="text-zinc-300 text-xs">–</span>
        <input type="date" aria-label="To date" className="nexora-input w-auto" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} />
        {(fromDate || toDate || search) && (
          <button onClick={() => { setFromDate(""); setToDate(""); setSearch(""); }} className="nexora-btn nexora-btn-ghost text-xs py-2">
            Clear
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-6">
        {REFERENCE_TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => toggleType(opt.value)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              activeTypes.includes(opt.value)
                ? "bg-black text-white border-black"
                : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="nexora-card overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Date</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Type</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Product</th>
              <th className="text-center px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Qty</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Location</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">By</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Recipient / Reason</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Reference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-10 text-zinc-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-10 text-zinc-400">No movements found</td></tr>
            ) : (
              paginated.map((m) => {
                const product = products.get(m.productId);
                return (
                  <tr key={m.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">{formatDate(m.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${TYPE_BADGE[m.type] || "badge-default"} capitalize`}>{m.type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-black">{product?.name || "—"}</p>
                      <p className="text-xs text-zinc-400">{product?.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-center font-medium">{m.qty > 0 ? `+${m.qty}` : m.qty}</td>
                    <td className="px-4 py-3 text-zinc-600 text-xs">
                      {m.type === "transfer" ? `${locationLabel(m.fromLocation)} → ${locationLabel(m.toLocation)}` : locationLabel(m.location)}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{m.performedByName || m.performedBy}</td>
                    <td className="px-4 py-3 text-zinc-600 text-xs">
                      {m.recipient ? `${m.recipient}${m.reason ? ` (${m.reason === "job" ? "Job/Repair" : m.reason === "sale" ? "Sale" : m.reasonDetail || "Other"})` : ""}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{m.note}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
    </div>
  );
}
