"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getProducts, getAvailableUnits, createStockTransfer } from "@/lib/firestore";
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

export default function NewStockTransferPage() {
  const router = useRouter();
  const { user, userDisplayName, can, loading: authLoading } = useAuth();
  const canCreate = can("stockTransfer.create");
  const [products, setProducts] = useState<Product[]>([]);
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
    getProducts().then((p) => setProducts((p as Product[]).filter((x) => x.storesStock > 0)));
  }, []);

  const selectedProduct = products.find((p) => p.id === productId);

  useEffect(() => {
    if (!selectedProduct?.trackSerial) { setAvailableUnits([]); setSelectedSerials([]); return; }
    setLoadingUnits(true);
    getAvailableUnits(selectedProduct.id, "stores").then((units) => {
      setAvailableUnits(units as { id: string; serialNumber: string }[]);
      setSelectedSerials([]);
      setLoadingUnits(false);
    });
  }, [productId]);

  const toggleSerial = (serial: string) => {
    setSelectedSerials((s) => (s.includes(serial) ? s.filter((x) => x !== serial) : [...s, serial]));
  };

  const handleAddItem = () => {
    setError("");
    if (!selectedProduct) { setError("Choose a product."); return; }

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
      if (n > selectedProduct.storesStock) { setError(`Only ${selectedProduct.storesStock} available in Stores.`); return; }
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

  const handleSubmit = async () => {
    if (items.length === 0) { setError("Add at least one item."); return; }
    setSaving(true);
    setError("");
    try {
      await createStockTransfer({
        transferredById: user!.uid,
        transferredByName: userDisplayName || user?.email || "Unknown",
        note,
        items: items.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          sku: i.sku,
          qty: i.qty,
          serialNumbers: i.serialNumbers,
        })),
      });
      router.push("/stock-transfer");
    } catch (err: any) {
      setError(err.message || "Failed to save transfer.");
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
          <p className="text-sm text-zinc-500">You don't have permission to create a stock transfer.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <Link href="/stock-transfer" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-black mb-4">
        <ArrowLeft size={14} /> Back to Stock Transfer
      </Link>
      <h1 className="font-prata text-2xl text-black mb-1">New Stock Transfer</h1>
      <p className="text-zinc-500 text-sm mb-8">Moves items from Stores Stock to Showroom Stock.</p>

      <div className="nexora-card p-4 sm:p-6 mb-6">
        <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Note (optional)</label>
        <input className="nexora-input" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <div className="nexora-card p-4 sm:p-6 mb-6">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Add Item</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div className="sm:col-span-2">
            <label className="block text-xs text-zinc-500 mb-1">Product (Stores stock only)</label>
            <SearchableSelect
              value={productId}
              onChange={setProductId}
              placeholder="Select a product"
              options={products.map((p) => ({
                id: p.id,
                label: `${p.name} (${p.sku}) — ${p.storesStock} in Stores`,
                sublabel: p.sku,
              }))}
            />
          </div>
          {selectedProduct?.trackSerial ? (
            <div className="sm:col-span-2">
              <label className="block text-xs text-zinc-500 mb-1">Serial Numbers in Stores — {selectedSerials.length} selected</label>
              {loadingUnits ? (
                <p className="text-xs text-zinc-400 py-2">Loading…</p>
              ) : availableUnits.length === 0 ? (
                <p className="text-xs text-zinc-400 py-2">No serialized units available in Stores.</p>
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
              <label className="block text-xs text-zinc-500 mb-1">Quantity (max {selectedProduct.storesStock})</label>
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
        {saving ? "Saving…" : "Save Transfer"}
      </button>
    </div>
  );
}
