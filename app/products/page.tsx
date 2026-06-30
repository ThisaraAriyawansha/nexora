"use client";
import { useEffect, useState } from "react";
import {
  getProducts, addProduct, updateProduct, deleteProduct,
  getBrands, getMainCategories, getSubCategories, addBatch, getAllBatches, updateBatch,
} from "@/lib/firestore";
import { useAuth } from "@/hooks/useAuth";
import { Product, Brand, MainCategory, SubCategory } from "@/types";
import { Plus, Search, Edit2, Trash2, Package, ChevronDown, X, Layers } from "lucide-react";

export default function ProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [mainCats, setMainCats] = useState<MainCategory[]>([]);
  const [subCats, setSubCats] = useState<SubCategory[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState<string | null>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editBatchForm, setEditBatchForm] = useState({ costPrice: "", sellingPrice: "", totalQty: "", remainingQty: "", note: "" });

  const [form, setForm] = useState({
    name: "", brandId: "", mainCategoryId: "", subCategoryId: "",
    sku: "", sellingPrice: "", totalStock: "", lowStockAlert: "5",
    description: "", warrantyMonths: "0",
  });
  const [batchForm, setBatchForm] = useState({ costPrice: "", sellingPrice: "", qty: "", note: "" });

  const filteredSubCats = subCats.filter(s => s.mainCategoryId === form.mainCategoryId);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [p, b, mc, sc] = await Promise.all([
      getProducts(), getBrands(), getMainCategories(), getSubCategories(),
    ]);
    setProducts(p as Product[]);
    setBrands(b as Brand[]);
    setMainCats(mc as MainCategory[]);
    setSubCats(sc as SubCategory[]);
    setLoading(false);
  }

  const openAdd = () => {
    setEditingProduct(null);
    setForm({ name: "", brandId: "", mainCategoryId: "", subCategoryId: "", sku: "", sellingPrice: "", totalStock: "", lowStockAlert: "5", description: "", warrantyMonths: "0" });
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setForm({
      name: p.name, brandId: p.brandId, mainCategoryId: p.mainCategoryId,
      subCategoryId: p.subCategoryId, sku: p.sku,
      sellingPrice: String(p.sellingPrice), totalStock: String(p.totalStock),
      lowStockAlert: String(p.lowStockAlert), description: p.description || "",
      warrantyMonths: String(p.warrantyMonths || 0),
    });
    setShowModal(true);
  };

  const openBatches = async (productId: string) => {
    setShowBatchModal(productId);
    const b = await getAllBatches(productId);
    setBatches(b);
  };

  const openEditBatch = (b: any) => {
    setEditingBatchId(b.id);
    setEditBatchForm({
      costPrice: String(b.costPrice),
      sellingPrice: b.sellingPrice != null ? String(b.sellingPrice) : "",
      totalQty: String(b.totalQty),
      remainingQty: String(b.remainingQty),
      note: b.note || "",
    });
  };

  const handleUpdateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showBatchModal || !editingBatchId) return;
    await updateBatch(showBatchModal, editingBatchId, {
      costPrice: Number(editBatchForm.costPrice),
      sellingPrice: editBatchForm.sellingPrice ? Number(editBatchForm.sellingPrice) : undefined,
      totalQty: Number(editBatchForm.totalQty),
      remainingQty: Number(editBatchForm.remainingQty),
      note: editBatchForm.note,
    }, user?.uid);
    setEditingBatchId(null);
    const b = await getAllBatches(showBatchModal);
    setBatches(b);
    loadData();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: form.name,
      brandId: form.brandId,
      mainCategoryId: form.mainCategoryId,
      subCategoryId: form.subCategoryId,
      sku: form.sku,
      sellingPrice: Number(form.sellingPrice),
      totalStock: Number(form.totalStock),
      lowStockAlert: Number(form.lowStockAlert),
      description: form.description,
      warrantyMonths: Number(form.warrantyMonths),
    };
    if (editingProduct) {
      await updateProduct(editingProduct.id, data);
    } else {
      await addProduct(data as any);
    }
    setShowModal(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    await deleteProduct(id);
    loadData();
  };

  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showBatchModal) return;
    await addBatch(showBatchModal, {
      costPrice: Number(batchForm.costPrice),
      sellingPrice: batchForm.sellingPrice ? Number(batchForm.sellingPrice) : undefined,
      qty: Number(batchForm.qty),
      note: batchForm.note,
    });
    setBatchForm({ costPrice: "", sellingPrice: "", qty: "", note: "" });
    const b = await getAllBatches(showBatchModal);
    setBatches(b);
    loadData();
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const getBrand = (id: string) => brands.find(b => b.id === id)?.name || "—";
  const getMainCat = (id: string) => mainCats.find(c => c.id === id)?.name || "—";
  const getSubCat = (id: string) => subCats.find(c => c.id === id)?.name || "—";

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-prata text-2xl text-black">Products</h1>
          <p className="text-zinc-500 text-sm mt-1">{products.length} items in inventory</p>
        </div>
        <button onClick={openAdd} className="nexora-btn nexora-btn-primary self-start sm:self-auto">
          <Plus size={14} /> Add Product
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6 sm:max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          className="nexora-input pl-9"
          placeholder="Search by name or SKU…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="nexora-card overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Product</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Brand</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Category</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Selling Price</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Stock</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Batches</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-zinc-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-zinc-400">No products found</td></tr>
            ) : (
              filtered.map(p => (
                <tr key={p.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-black">{p.name}</p>
                    <p className="text-xs text-zinc-400">{p.sku}</p>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{getBrand(p.brandId)}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    <p>{getMainCat(p.mainCategoryId)}</p>
                    <p className="text-xs text-zinc-400">{getSubCat(p.subCategoryId)}</p>
                  </td>
                  <td className="px-4 py-3 font-medium">Rs. {p.sellingPrice?.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${p.totalStock <= p.lowStockAlert ? "badge-danger" : "badge-success"}`}>
                      {p.totalStock} units
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openBatches(p.id)}
                      className="nexora-btn nexora-btn-ghost text-xs py-1 px-2"
                    >
                      <Layers size={12} /> View batches
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(p)} className="nexora-btn nexora-btn-ghost py-1 px-2">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="nexora-btn nexora-btn-ghost py-1 px-2 text-red-500">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h2 className="font-prata text-lg text-black">{editingProduct ? "Edit Product" : "Add Product"}</h2>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-black transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Product Name</label>
                <input className="nexora-input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Brand</label>
                  <select className="nexora-input" required value={form.brandId} onChange={e => setForm({...form, brandId: e.target.value})}>
                    <option value="">Select brand</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">SKU</label>
                  <input className="nexora-input" required value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Main Category</label>
                  <select className="nexora-input" required value={form.mainCategoryId} onChange={e => setForm({...form, mainCategoryId: e.target.value, subCategoryId: ""})}>
                    <option value="">Select</option>
                    {mainCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Sub Category</label>
                  <select className="nexora-input" required value={form.subCategoryId} onChange={e => setForm({...form, subCategoryId: e.target.value})}>
                    <option value="">Select</option>
                    {filteredSubCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Selling Price (Rs.)</label>
                  <input type="number" className="nexora-input" required value={form.sellingPrice} onChange={e => setForm({...form, sellingPrice: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Initial Stock</label>
                  <input type="number" className="nexora-input" required value={form.totalStock} onChange={e => setForm({...form, totalStock: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Low Stock Alert</label>
                  <input type="number" className="nexora-input" value={form.lowStockAlert} onChange={e => setForm({...form, lowStockAlert: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Warranty (months)</label>
                  <input type="number" className="nexora-input" value={form.warrantyMonths} onChange={e => setForm({...form, warrantyMonths: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Description</label>
                <textarea className="nexora-input resize-none" rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="nexora-btn nexora-btn-primary flex-1 justify-center">
                  {editingProduct ? "Update" : "Add Product"}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="nexora-btn nexora-btn-outline">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h2 className="font-prata text-lg text-black">Stock Batches</h2>
              <button onClick={() => { setShowBatchModal(null); setEditingBatchId(null); }} className="text-zinc-400 hover:text-black">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-4">
              {/* Existing batches */}
              {batches.length === 0 ? (
                <p className="text-sm text-zinc-400 mb-4">No batches yet</p>
              ) : (
                <div className="space-y-2 mb-4 max-h-72 overflow-y-auto">
                  {batches.map((b, i) =>
                    editingBatchId === b.id ? (
                      <form key={b.id} onSubmit={handleUpdateBatch} className="p-3 bg-zinc-50 rounded-lg space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-zinc-500 mb-1">Cost Price (Rs.)</label>
                            <input type="number" required className="nexora-input" value={editBatchForm.costPrice} onChange={e => setEditBatchForm({ ...editBatchForm, costPrice: e.target.value })} />
                          </div>
                          <div>
                            <label className="block text-xs text-zinc-500 mb-1">Selling Price (Rs.)</label>
                            <input type="number" className="nexora-input" value={editBatchForm.sellingPrice} onChange={e => setEditBatchForm({ ...editBatchForm, sellingPrice: e.target.value })} placeholder="Use product price" />
                          </div>
                          <div>
                            <label className="block text-xs text-zinc-500 mb-1">Total Qty</label>
                            <input type="number" required className="nexora-input" value={editBatchForm.totalQty} onChange={e => setEditBatchForm({ ...editBatchForm, totalQty: e.target.value })} />
                          </div>
                          <div>
                            <label className="block text-xs text-zinc-500 mb-1">Remaining Qty</label>
                            <input type="number" required className="nexora-input" value={editBatchForm.remainingQty} onChange={e => setEditBatchForm({ ...editBatchForm, remainingQty: e.target.value })} />
                          </div>
                        </div>
                        <input className="nexora-input" placeholder="Note (optional)" value={editBatchForm.note} onChange={e => setEditBatchForm({ ...editBatchForm, note: e.target.value })} />
                        <div className="flex gap-2">
                          <button type="submit" className="nexora-btn nexora-btn-primary flex-1 justify-center text-xs py-1.5">Save</button>
                          <button type="button" onClick={() => setEditingBatchId(null)} className="nexora-btn nexora-btn-outline text-xs py-1.5">Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <div key={b.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-black">Batch {i + 1}</p>
                          <p className="text-xs text-zinc-400">
                            Cost: Rs. {b.costPrice?.toLocaleString()}
                            {b.sellingPrice != null && <> · Sells: Rs. {b.sellingPrice.toLocaleString()}</>}
                          </p>
                          {b.note && <p className="text-xs text-zinc-400">{b.note}</p>}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-medium">{b.remainingQty} / {b.totalQty} units</p>
                            <span className={`badge ${b.status === "active" ? "badge-success" : "badge-default"}`}>{b.status}</span>
                          </div>
                          <button onClick={() => openEditBatch(b)} className="nexora-btn nexora-btn-ghost p-1.5"><Edit2 size={12} /></button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Add new batch */}
              <div className="border-t border-zinc-100 pt-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Add New Batch</p>
                <form onSubmit={handleAddBatch} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Cost Price (Rs.)</label>
                      <input type="number" required className="nexora-input" value={batchForm.costPrice} onChange={e => setBatchForm({...batchForm, costPrice: e.target.value})} placeholder="e.g. 2000" />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Selling Price (Rs.)</label>
                      <input type="number" className="nexora-input" value={batchForm.sellingPrice} onChange={e => setBatchForm({...batchForm, sellingPrice: e.target.value})} placeholder="Use product price" />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Quantity</label>
                      <input type="number" required className="nexora-input" value={batchForm.qty} onChange={e => setBatchForm({...batchForm, qty: e.target.value})} placeholder="e.g. 50" />
                    </div>
                  </div>
                  <input className="nexora-input" placeholder="Note (optional)" value={batchForm.note} onChange={e => setBatchForm({...batchForm, note: e.target.value})} />
                  <button type="submit" className="nexora-btn nexora-btn-primary w-full justify-center">
                    <Plus size={14} /> Add Batch
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
