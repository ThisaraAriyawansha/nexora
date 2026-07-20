"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getProducts, getAvailableUnits, getJobs, createStockOut } from "@/lib/firestore";
import { useAuth } from "@/hooks/useAuth";
import { Product } from "@/types";
import { Plus, Trash2, ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import SearchableSelect from "@/components/ui/SearchableSelect";

interface DraftItem {
  tempId: string;
  productId: string;
  productName: string;
  sku: string;
  qty: number;
  serialNumbers?: string[];
}

export default function NewStockOutPage() {
  const router = useRouter();
  const { user, userDisplayName, can, loading: authLoading } = useAuth();
  const canCreate = can("stockOut.create");
  const [products, setProducts] = useState<Product[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);

  const [location, setLocation] = useState<"stores" | "showroom">("showroom");
  const [recipient, setRecipient] = useState("");
  const [reason, setReason] = useState<"job" | "sale" | "other">("job");
  const [jobId, setJobId] = useState("");
  const [reasonDetail, setReasonDetail] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [availableUnits, setAvailableUnits] = useState<{ id: string; serialNumber: string }[]>([]);
  const [selectedSerials, setSelectedSerials] = useState<string[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);

  useEffect(() => {
    Promise.all([getProducts(), getJobs()]).then(([p, j]) => {
      setProducts(p as Product[]);
      setJobs(j as any[]);
    });
  }, []);

  const stockField = location === "showroom" ? "showroomStock" : "storesStock";
  const eligibleProducts = products.filter((p) => (p as any)[stockField] > 0);
  const selectedProduct = products.find((p) => p.id === productId);

  useEffect(() => {
    setProductId("");
    setQty("");
    setSelectedSerials([]);
  }, [location]);

  useEffect(() => {
    if (!selectedProduct?.trackSerial) { setAvailableUnits([]); setSelectedSerials([]); return; }
    setLoadingUnits(true);
    getAvailableUnits(selectedProduct.id, location).then((units) => {
      setAvailableUnits(units as { id: string; serialNumber: string }[]);
      setSelectedSerials([]);
      setLoadingUnits(false);
    });
  }, [productId, location]);

  const toggleSerial = (serial: string) => {
    setSelectedSerials((s) => (s.includes(serial) ? s.filter((x) => x !== serial) : [...s, serial]));
  };

  const handleAddItem = () => {
    setError("");
    if (!selectedProduct) { setError("Choose a product."); return; }
    const available = (selectedProduct as any)[stockField] as number;

    if (selectedProduct.trackSerial) {
      if (selectedSerials.length === 0) { setError("Select at least one serial number."); return; }
      setItems([...items, {
        tempId: Date.now().toString(),
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        sku: selectedProduct.sku,
        qty: selectedSerials.length,
        serialNumbers: selectedSerials,
      }]);
    } else {
      const n = Number(qty);
      if (!qty || n <= 0) { setError("Enter a quantity."); return; }
      if (n > available) { setError(`Only ${available} available in ${location === "showroom" ? "Showroom" : "Stores"}.`); return; }
      setItems([...items, {
        tempId: Date.now().toString(),
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        sku: selectedProduct.sku,
        qty: n,
      }]);
    }
    setProductId("");
    setQty("");
    setSelectedSerials([]);
  };

  const removeItem = (tempId: string) => setItems(items.filter((i) => i.tempId !== tempId));

  const selectedJob = jobs.find((j) => j.id === jobId);

  const handleSubmit = async () => {
    if (items.length === 0) { setError("Add at least one item."); return; }
    if (!recipient.trim()) { setError("Enter who this stock is being issued to."); return; }
    if (reason === "other" && !reasonDetail.trim()) { setError("Enter a reason."); return; }
    if (reason === "job" && !jobId) { setError("Select a job."); return; }
    setSaving(true);
    setError("");
    try {
      await createStockOut({
        location,
        issuedById: user!.uid,
        issuedByName: userDisplayName || user?.email || "Unknown",
        recipient: recipient.trim(),
        reason,
        reasonDetail: reason === "other" ? reasonDetail.trim() : undefined,
        jobId: reason === "job" ? jobId : null,
        jobNo: reason === "job" ? selectedJob?.jobNo : null,
        note,
        items: items.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          sku: i.sku,
          qty: i.qty,
          serialNumbers: i.serialNumbers,
        })),
      });
      router.push("/stock-out");
    } catch (err: any) {
      setError(err.message || "Failed to save stock-out.");
    } finally {
      setSaving(false);
    }
  };

  if (!authLoading && !canCreate) {
    return (
      <div className="p-4 sm:p-8">
        <div className="nexora-card p-8 text-center max-w-md mx-auto">
          <ShieldCheck size={24} className="text-zinc-300 mx-auto mb-3" />
          <h1 className="font-prata text-lg text-black mb-1">Access Restricted</h1>
          <p className="text-sm text-zinc-500">You don't have permission to create a stock out record.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <Link href="/stock-out" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-black mb-4">
        <ArrowLeft size={14} /> Back to Stock Out
      </Link>
      <h1 className="font-prata text-2xl text-black mb-1">New Stock Out</h1>
      <p className="text-zinc-500 text-sm mb-8">Issue stock out for a repair job, an off-POS sale, or another reason.</p>

      <div className="nexora-card p-4 sm:p-6 mb-6 space-y-4">
        <div>
          <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Issue From</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setLocation("showroom")} className={`nexora-btn text-xs ${location === "showroom" ? "nexora-btn-primary" : "nexora-btn-outline"}`}>Showroom</button>
            <button type="button" onClick={() => setLocation("stores")} className={`nexora-btn text-xs ${location === "stores" ? "nexora-btn-primary" : "nexora-btn-outline"}`}>Stores</button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Issued To</label>
            <input className="nexora-input" placeholder="Customer, technician, or department" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Reason</label>
            <select className="nexora-input" value={reason} onChange={(e) => setReason(e.target.value as any)}>
              <option value="job">Job / Repair</option>
              <option value="sale">Sale</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {reason === "job" && (
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Job</label>
            <select className="nexora-input" value={jobId} onChange={(e) => setJobId(e.target.value)}>
              <option value="">Select a job</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.jobNo} — {j.customerName}</option>)}
            </select>
          </div>
        )}
        {reason === "other" && (
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Reason Detail</label>
            <input className="nexora-input" value={reasonDetail} onChange={(e) => setReasonDetail(e.target.value)} />
          </div>
        )}
        <div>
          <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Note (optional)</label>
          <input className="nexora-input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      <div className="nexora-card p-4 sm:p-6 mb-6">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Add Item</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div className="sm:col-span-2">
            <label className="block text-xs text-zinc-500 mb-1">Product ({location === "showroom" ? "Showroom" : "Stores"} stock only)</label>
            <SearchableSelect
              value={productId}
              onChange={setProductId}
              placeholder="Select a product"
              options={eligibleProducts.map((p) => ({
                id: p.id,
                label: `${p.name} (${p.sku}) — ${(p as any)[stockField]} available`,
                sublabel: p.sku,
              }))}
            />
          </div>
          {selectedProduct?.trackSerial ? (
            <div className="sm:col-span-2">
              <label className="block text-xs text-zinc-500 mb-1">Serial Numbers — {selectedSerials.length} selected</label>
              {loadingUnits ? (
                <p className="text-xs text-zinc-400 py-2">Loading…</p>
              ) : availableUnits.length === 0 ? (
                <p className="text-xs text-zinc-400 py-2">No serialized units available here.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1 border border-zinc-200 rounded-lg p-2">
                  {availableUnits.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-xs font-mono px-1 py-1 rounded hover:bg-zinc-50 cursor-pointer">
                      <input type="checkbox" checked={selectedSerials.includes(u.serialNumber)} onChange={() => toggleSerial(u.serialNumber)} />
                      {u.serialNumber}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : selectedProduct ? (
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Quantity (max {(selectedProduct as any)[stockField]})</label>
              <input type="number" className="nexora-input" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
          ) : null}
        </div>
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
        <button type="button" onClick={handleAddItem} className="nexora-btn nexora-btn-outline text-xs">
          <Plus size={13} /> Add Item
        </button>
      </div>

      {items.length > 0 && (
        <div className="nexora-card p-4 sm:p-6 mb-6">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Items ({items.length})</p>
          <div className="space-y-2">
            {items.map((i) => (
              <div key={i.tempId} className="flex items-center justify-between gap-2 p-3 bg-zinc-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-black">{i.productName}</p>
                  <p className="text-xs text-zinc-400">
                    {i.sku} · Qty {i.qty}
                    {i.serialNumbers && <> · {i.serialNumbers.join(", ")}</>}
                  </p>
                </div>
                <button onClick={() => removeItem(i.tempId)} className="text-zinc-300 hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={saving || items.length === 0}
        className="nexora-btn nexora-btn-primary w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {saving ? "Saving…" : "Save Stock Out"}
      </button>
    </div>
  );
}
