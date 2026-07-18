"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getProducts, getSuppliers, createGrn } from "@/lib/firestore";
import { useAuth } from "@/hooks/useAuth";
import { Product, Supplier } from "@/types";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import SearchableSelect from "@/components/ui/SearchableSelect";

interface DraftItem {
  tempId: string;
  productId: string;
  productName: string;
  sku: string;
  trackSerial: boolean;
  qty: number;
  costPrice: number;
  sellingPrice: string;
  serials: string;
}

export default function NewGrnPage() {
  const router = useRouter();
  const { user, userDisplayName } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [serials, setSerials] = useState("");

  useEffect(() => {
    Promise.all([getProducts(), getSuppliers()]).then(([p, s]) => {
      setProducts(p as Product[]);
      setSuppliers(s as Supplier[]);
    });
  }, []);

  const selectedProduct = products.find((p) => p.id === productId);

  const handleAddItem = () => {
    setError("");
    if (!selectedProduct) { setError("Choose a product."); return; }
    if (!costPrice) { setError("Enter a cost price."); return; }

    let itemQty = Number(qty);
    if (selectedProduct.trackSerial) {
      const serialList = Array.from(new Set(serials.split("\n").map((s) => s.trim()).filter(Boolean)));
      if (serialList.length === 0) { setError("Enter at least one serial number."); return; }
      itemQty = serialList.length;
    } else if (!qty || itemQty <= 0) {
      setError("Enter a quantity.");
      return;
    }

    setItems([...items, {
      tempId: Date.now().toString(),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      sku: selectedProduct.sku,
      trackSerial: !!selectedProduct.trackSerial,
      qty: itemQty,
      costPrice: Number(costPrice),
      sellingPrice,
      serials,
    }]);
    setProductId("");
    setQty("");
    setCostPrice("");
    setSellingPrice("");
    setSerials("");
  };

  const removeItem = (tempId: string) => setItems(items.filter((i) => i.tempId !== tempId));

  const handleSubmit = async () => {
    if (items.length === 0) { setError("Add at least one item."); return; }
    setSaving(true);
    setError("");
    try {
      const supplier = suppliers.find((s) => s.id === supplierId);
      await createGrn({
        supplierId: supplierId || null,
        supplierName: supplier?.name || "",
        receivedById: user!.uid,
        receivedByName: userDisplayName || user?.email || "Unknown",
        note,
        items: items.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          sku: i.sku,
          qty: i.qty,
          costPrice: i.costPrice,
          sellingPrice: i.sellingPrice ? Number(i.sellingPrice) : undefined,
          serials: i.trackSerial ? Array.from(new Set(i.serials.split("\n").map((s) => s.trim()).filter(Boolean))) : undefined,
        })),
      });
      router.push("/grn");
    } catch (err: any) {
      setError(err.message || "Failed to save GRN.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <Link href="/grn" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-black mb-4">
        <ArrowLeft size={14} /> Back to GRN
      </Link>
      <h1 className="font-prata text-2xl text-black mb-1">New GRN</h1>
      <p className="text-zinc-500 text-sm mb-8">Received items are added to Stores Stock.</p>

      <div className="nexora-card p-4 sm:p-6 mb-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Supplier (optional)</label>
            <select className="nexora-input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">No supplier</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Note (optional)</label>
            <input className="nexora-input" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="nexora-card p-4 sm:p-6 mb-6">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Add Item</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div className="sm:col-span-2">
            <label className="block text-xs text-zinc-500 mb-1">Product</label>
            <SearchableSelect
              value={productId}
              onChange={setProductId}
              placeholder="Select a product"
              options={products.map((p) => ({ id: p.id, label: `${p.name} (${p.sku})`, sublabel: p.sku }))}
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Cost Price (Rs.)</label>
            <input type="number" className="nexora-input" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Selling Price (Rs.)</label>
            <input type="number" className="nexora-input" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} placeholder="Use product price" />
          </div>
          {selectedProduct?.trackSerial ? (
            <div className="sm:col-span-2">
              <label className="block text-xs text-zinc-500 mb-1">
                Serial Numbers (one per line) — {serials.split("\n").map((s) => s.trim()).filter(Boolean).length} units
              </label>
              <textarea className="nexora-input resize-none font-mono text-xs" rows={4} value={serials} onChange={(e) => setSerials(e.target.value)} placeholder={"e.g.\nSN-0001\nSN-0002"} />
            </div>
          ) : (
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Quantity</label>
              <input type="number" className="nexora-input" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
          )}
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
                  <p className="text-xs text-zinc-400">{i.sku} · Qty {i.qty} · Cost Rs. {i.costPrice.toLocaleString()}</p>
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
        {saving ? "Saving…" : "Save GRN"}
      </button>
    </div>
  );
}
