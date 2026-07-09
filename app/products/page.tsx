"use client";
import { useEffect, useState } from "react";
import {
  getProducts, addProduct, updateProduct, deleteProduct,
  getBrands, getMainCategories, getSubCategories, addBatch, getAllBatches, updateBatch, getAllUnits,
  getUnitsByBatch, updateUnitSerial, deleteUnit, addUnitsToBatch,
} from "@/lib/firestore";
import { useAuth } from "@/hooks/useAuth";
import { Product, Brand, MainCategory, SubCategory } from "@/types";
import { Plus, Search, Edit2, Trash2, Package, ChevronDown, X, Layers, Hash, Check } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Pagination from "@/components/ui/Pagination";

const PAGE_SIZE = 10;

export default function ProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [mainCats, setMainCats] = useState<MainCategory[]>([]);
  const [subCats, setSubCats] = useState<SubCategory[]>([]);
  const [search, setSearch] = useState("");
  const [filterMainCat, setFilterMainCat] = useState("");
  const [filterSubCat, setFilterSubCat] = useState("");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState<string | null>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editBatchForm, setEditBatchForm] = useState({ costPrice: "", sellingPrice: "", totalQty: "", remainingQty: "", note: "" });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingBatch, setAddingBatch] = useState(false);
  const [addingSerials, setAddingSerials] = useState(false);

  const [form, setForm] = useState({
    name: "", brandId: "", mainCategoryId: "", subCategoryId: "",
    sku: "", sellingPrice: "", costPrice: "", totalStock: "", lowStockAlert: "5",
    description: "", warrantyMonths: "0", trackSerial: false,
  });
  const [batchForm, setBatchForm] = useState({ costPrice: "", sellingPrice: "", qty: "", note: "", serials: "" });
  const [batchError, setBatchError] = useState("");
  const [manageSerialsBatch, setManageSerialsBatch] = useState<any | null>(null);
  const [editingBatchUnits, setEditingBatchUnits] = useState<any[]>([]);
  const [newSerialsForBatch, setNewSerialsForBatch] = useState("");
  const [unitActionError, setUnitActionError] = useState("");
  const [deleteUnitTarget, setDeleteUnitTarget] = useState<{ unitId: string; batchId: string; serialNumber: string } | null>(null);
  const [deletingUnit, setDeletingUnit] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const filteredSubCats = subCats.filter(s => s.mainCategoryId === form.mainCategoryId);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, filterMainCat, filterSubCat]);

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
    setForm({ name: "", brandId: "", mainCategoryId: "", subCategoryId: "", sku: "", sellingPrice: "", costPrice: "", totalStock: "", lowStockAlert: "5", description: "", warrantyMonths: "0", trackSerial: false });
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setForm({
      name: p.name, brandId: p.brandId, mainCategoryId: p.mainCategoryId,
      subCategoryId: p.subCategoryId, sku: p.sku,
      sellingPrice: String(p.sellingPrice), costPrice: "", totalStock: String(p.totalStock),
      lowStockAlert: String(p.lowStockAlert), description: p.description || "",
      warrantyMonths: String(p.warrantyMonths || 0), trackSerial: !!p.trackSerial,
    });
    setShowModal(true);
  };

  const openBatches = async (productId: string) => {
    setShowBatchModal(productId);
    setBatchError("");
    setUnitActionError("");
    setEditingBatchId(null);
    setManageSerialsBatch(null);
    setEditingBatchUnits([]);
    setNewSerialsForBatch("");
    setBatchForm({ costPrice: "", sellingPrice: "", qty: "", note: "", serials: "" });
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

  const openManageSerials = async (b: any) => {
    setManageSerialsBatch(b);
    setUnitActionError("");
    setNewSerialsForBatch("");
    if (!showBatchModal) return;
    const units = await getUnitsByBatch(showBatchModal, b.id);
    setEditingBatchUnits(units);
  };

  const refreshBatchModal = async () => {
    if (!showBatchModal) return;
    const b = await getAllBatches(showBatchModal);
    setBatches(b);
    if (manageSerialsBatch) {
      const units = await getUnitsByBatch(showBatchModal, manageSerialsBatch.id);
      setEditingBatchUnits(units);
      setManageSerialsBatch(b.find((x: any) => x.id === manageSerialsBatch.id) ?? null);
    }
    loadData();
  };

  const handleSaveUnitSerial = async (unitId: string, serialNumber: string) => {
    if (!showBatchModal) return;
    const trimmed = serialNumber.trim();
    if (!trimmed) { setUnitActionError("Serial number can't be empty."); return; }
    const dupe = editingBatchUnits.some(u => u.id !== unitId && u.serialNumber.toLowerCase() === trimmed.toLowerCase());
    if (dupe) { setUnitActionError(`"${trimmed}" is already used by another unit.`); return; }
    setUnitActionError("");
    await updateUnitSerial(showBatchModal, unitId, trimmed);
    await refreshBatchModal();
  };

  const handleDeleteUnit = (unitId: string, batchId: string, serialNumber: string) => {
    setDeleteUnitTarget({ unitId, batchId, serialNumber });
  };

  const confirmDeleteUnit = async () => {
    if (!showBatchModal || !deleteUnitTarget) return;
    setDeletingUnit(true);
    setUnitActionError("");
    try {
      await deleteUnit(showBatchModal, deleteUnitTarget.unitId, deleteUnitTarget.batchId);
      await refreshBatchModal();
      setDeleteUnitTarget(null);
    } catch (err: any) {
      setUnitActionError(err.message || "Could not remove this unit.");
      setDeleteUnitTarget(null);
    } finally {
      setDeletingUnit(false);
    }
  };

  const handleAddSerialsToBatch = async (batchId: string) => {
    if (!showBatchModal || addingSerials) return;
    const serials = Array.from(new Set(
      newSerialsForBatch.split("\n").map(s => s.trim()).filter(Boolean)
    ));
    if (serials.length === 0) { setUnitActionError("Enter at least one serial number."); return; }
    setAddingSerials(true);
    try {
      const existingUnits = await getAllUnits(showBatchModal) as unknown as { serialNumber: string }[];
      const existingSerials = new Set(existingUnits.map(u => u.serialNumber.toLowerCase()));
      const dupes = serials.filter(s => existingSerials.has(s.toLowerCase()));
      if (dupes.length > 0) { setUnitActionError(`Already in stock: ${dupes.join(", ")}`); return; }
      setUnitActionError("");
      await addUnitsToBatch(showBatchModal, batchId, serials);
      setNewSerialsForBatch("");
      await refreshBatchModal();
    } finally {
      setAddingSerials(false);
    }
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
    if (saving) return;
    setSaving(true);
    try {
      const data = {
        name: form.name,
        brandId: form.brandId,
        mainCategoryId: form.mainCategoryId,
        subCategoryId: form.subCategoryId,
        sku: form.sku,
        sellingPrice: Number(form.sellingPrice),
        totalStock: form.trackSerial ? (editingProduct?.totalStock ?? 0) : Number(form.totalStock),
        lowStockAlert: Number(form.lowStockAlert),
        description: form.description,
        warrantyMonths: Number(form.warrantyMonths),
        trackSerial: form.trackSerial,
      };
      if (editingProduct) {
        await updateProduct(editingProduct.id, data);
      } else {
        // Seed stock at 0 — addBatch below increments it from there, so
        // pre-filling it here would double-count the initial quantity.
        const productRef = await addProduct({ ...data, totalStock: 0 } as any);
        if (!form.trackSerial && Number(form.totalStock) > 0) {
          await addBatch(productRef.id, {
            costPrice: Number(form.costPrice),
            sellingPrice: Number(form.sellingPrice),
            qty: Number(form.totalStock),
          });
        }
      }
      setShowModal(false);
      loadData();
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: Product) => {
    if (togglingId) return;
    setTogglingId(p.id);
    try {
      await updateProduct(p.id, { active: !p.active });
      setProducts(prev => prev.map(x => x.id === p.id ? { ...x, active: !p.active } : x));
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteProduct(deleteId);
      setDeleteId(null);
      loadData();
    } finally {
      setDeleting(false);
    }
  };

  const batchModalProduct = products.find(p => p.id === showBatchModal);

  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showBatchModal || addingBatch) return;
    setBatchError("");
    setAddingBatch(true);
    try {
      let serials: string[] | undefined;
      if (batchModalProduct?.trackSerial) {
        serials = Array.from(new Set(
          batchForm.serials.split("\n").map(s => s.trim()).filter(Boolean)
        ));
        if (serials.length === 0) {
          setBatchError("Enter at least one serial number.");
          return;
        }
        const existingUnits = await getAllUnits(showBatchModal) as unknown as { serialNumber: string }[];
        const existingSerials = new Set(existingUnits.map(u => u.serialNumber.toLowerCase()));
        const dupes = serials.filter(s => existingSerials.has(s.toLowerCase()));
        if (dupes.length > 0) {
          setBatchError(`Already in stock: ${dupes.join(", ")}`);
          return;
        }
      }

      await addBatch(showBatchModal, {
        costPrice: Number(batchForm.costPrice),
        sellingPrice: batchForm.sellingPrice ? Number(batchForm.sellingPrice) : undefined,
        qty: Number(batchForm.qty),
        note: batchForm.note,
        serials,
      });
      setBatchForm({ costPrice: "", sellingPrice: "", qty: "", note: "", serials: "" });
      const b = await getAllBatches(showBatchModal);
      setBatches(b);
      loadData();
    } finally {
      setAddingBatch(false);
    }
  };

  const filterSubCatOptions = subCats.filter(s => s.mainCategoryId === filterMainCat);

  const filtered = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filterMainCat && p.mainCategoryId !== filterMainCat) return false;
    if (filterSubCat && p.subCategoryId !== filterSubCat) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

      {/* Search & filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="relative flex-1 min-w-[200px] sm:max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            className="nexora-input pl-9"
            placeholder="Search by name or SKU…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="nexora-input w-auto"
          value={filterMainCat}
          onChange={e => { setFilterMainCat(e.target.value); setFilterSubCat(""); }}
        >
          <option value="">All categories</option>
          {mainCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          className="nexora-input w-auto"
          value={filterSubCat}
          onChange={e => setFilterSubCat(e.target.value)}
          disabled={!filterMainCat}
        >
          <option value="">All subcategories</option>
          {filterSubCatOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {(filterMainCat || filterSubCat) && (
          <button
            onClick={() => { setFilterMainCat(""); setFilterSubCat(""); }}
            className="nexora-btn nexora-btn-ghost text-xs py-2"
          >
            Clear
          </button>
        )}
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
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-10 text-zinc-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-10 text-zinc-400">No products found</td></tr>
            ) : (
              paginated.map(p => (
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
                    <button
                      onClick={() => toggleActive(p)}
                      disabled={togglingId === p.id}
                      className="flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                      title={p.active !== false ? "Active — visible on POS. Click to deactivate." : "Inactive — hidden from POS. Click to reactivate."}
                    >
                      <span className={`text-xs font-medium ${p.active !== false ? "text-black" : "text-zinc-300"}`}>Active</span>
                      <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${p.active !== false ? "bg-green-500" : "bg-zinc-200"}`}>
                        <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full bg-white shadow transition-transform ${p.active !== false ? "translate-x-4" : "translate-x-0.5"}`}>
                          {p.active !== false ? <Check size={10} className="text-green-600" strokeWidth={3} /> : <X size={10} className="text-zinc-400" strokeWidth={3} />}
                        </span>
                      </span>
                      <span className={`text-xs font-medium ${p.active !== false ? "text-zinc-300" : "text-black"}`}>Inactive</span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(p)} className="nexora-btn nexora-btn-ghost py-1 px-2">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => setDeleteId(p.id)} className="nexora-btn nexora-btn-ghost py-1 px-2 text-red-500">
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

      <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {/* Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h2 className="font-prata text-lg text-black">{editingProduct ? "Edit Product" : "Add Product"}</h2>
              <button disabled={saving} onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-black transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
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
                  {form.trackSerial ? (
                    <div className="nexora-input flex items-center text-zinc-400 text-sm">
                      {editingProduct ? `${editingProduct.totalStock} units` : "0 — add via batches"}
                    </div>
                  ) : (
                    <input type="number" className="nexora-input" required value={form.totalStock} onChange={e => setForm({...form, totalStock: e.target.value})} />
                  )}
                </div>
              </div>
              {!editingProduct && !form.trackSerial && (
                <div>
                  <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Cost Price (Rs.)</label>
                  <input type="number" className="nexora-input" required value={form.costPrice} onChange={e => setForm({...form, costPrice: e.target.value})} placeholder="Cost per unit for the first batch" />
                </div>
              )}
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
              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={form.trackSerial}
                  onChange={e => setForm({...form, trackSerial: e.target.checked})}
                />
                <span>
                  <span className="block text-sm font-medium text-black">Track Serial Numbers</span>
                  <span className="block text-xs text-zinc-400 mt-0.5">For items like laptops or phones — each unit is stocked in with its own serial, sold individually, and gets its own warranty record.</span>
                </span>
              </label>
              <div>
                <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Description</label>
                <textarea className="nexora-input resize-none" rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="nexora-btn nexora-btn-primary flex-1 justify-center disabled:opacity-60 disabled:cursor-not-allowed">
                  {saving ? "Saving…" : editingProduct ? "Update" : "Add Product"}
                </button>
                <button type="button" disabled={saving} onClick={() => setShowModal(false)} className="nexora-btn nexora-btn-outline disabled:opacity-60 disabled:cursor-not-allowed">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
              <h2 className="font-prata text-lg text-black">Stock Batches</h2>
              <button onClick={() => { setShowBatchModal(null); setEditingBatchId(null); setBatchError(""); setManageSerialsBatch(null); setEditingBatchUnits([]); setUnitActionError(""); }} className="text-zinc-400 hover:text-black">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1 min-h-0">
              {/* Existing batches */}
              {batches.length === 0 ? (
                <p className="text-sm text-zinc-400 mb-4">No batches yet</p>
              ) : (
                <div className="space-y-2 mb-4 max-h-72 overflow-y-auto">
                  {batches.map((b, i) =>
                    editingBatchId === b.id ? (
                      <form key={b.id} onSubmit={handleUpdateBatch} className="p-3 bg-zinc-50 rounded-lg space-y-2">
                        <p className="text-sm font-medium text-black">Editing Batch {i + 1}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-zinc-500 mb-1">Cost Price (Rs.)</label>
                            <input type="number" required className="nexora-input" value={editBatchForm.costPrice} onChange={e => setEditBatchForm({ ...editBatchForm, costPrice: e.target.value })} />
                          </div>
                          <div>
                            <label className="block text-xs text-zinc-500 mb-1">Selling Price (Rs.)</label>
                            <input type="number" className="nexora-input" value={editBatchForm.sellingPrice} onChange={e => setEditBatchForm({ ...editBatchForm, sellingPrice: e.target.value })} placeholder="Use product price" />
                          </div>
                          {batchModalProduct?.trackSerial ? (
                            <div className="col-span-2">
                              <label className="block text-xs text-zinc-500 mb-1">Units</label>
                              <div className="nexora-input flex items-center text-zinc-400 text-sm">
                                {editBatchForm.remainingQty} / {editBatchForm.totalQty} — managed via serial numbers below
                              </div>
                            </div>
                          ) : (
                            <>
                              <div>
                                <label className="block text-xs text-zinc-500 mb-1">Total Qty</label>
                                <input type="number" required className="nexora-input" value={editBatchForm.totalQty} onChange={e => setEditBatchForm({ ...editBatchForm, totalQty: e.target.value })} />
                              </div>
                              <div>
                                <label className="block text-xs text-zinc-500 mb-1">Remaining Qty</label>
                                <input type="number" required className="nexora-input" value={editBatchForm.remainingQty} onChange={e => setEditBatchForm({ ...editBatchForm, remainingQty: e.target.value })} />
                              </div>
                            </>
                          )}
                        </div>
                        <input className="nexora-input" placeholder="Note (optional)" value={editBatchForm.note} onChange={e => setEditBatchForm({ ...editBatchForm, note: e.target.value })} />
                        <div className="flex gap-2">
                          <button type="submit" className="nexora-btn nexora-btn-primary flex-1 justify-center text-xs py-1.5">Save</button>
                          <button type="button" onClick={() => setEditingBatchId(null)} className="nexora-btn nexora-btn-outline text-xs py-1.5">Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-3 bg-zinc-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-black">Batch {i + 1}</p>
                          <p className="text-xs text-zinc-400">
                            Cost: Rs. {b.costPrice?.toLocaleString()}
                            {b.sellingPrice != null && <> · Sells: Rs. {b.sellingPrice.toLocaleString()}</>}
                          </p>
                          {b.note && <p className="text-xs text-zinc-400">{b.note}</p>}
                        </div>
                        <div className="flex items-center gap-3 ml-auto">
                          <div className="text-right">
                            <p className="text-sm font-medium">{b.remainingQty} / {b.totalQty} units</p>
                            <span className={`badge ${b.status === "active" ? "badge-success" : "badge-default"}`}>{b.status}</span>
                          </div>
                          {batchModalProduct?.trackSerial && (
                            <button onClick={() => openManageSerials(b)} className="nexora-btn nexora-btn-ghost p-1.5" title="Manage serial numbers"><Hash size={12} /></button>
                          )}
                          <button onClick={() => openEditBatch(b)} className="nexora-btn nexora-btn-ghost p-1.5" title="Edit price"><Edit2 size={12} /></button>
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
                    {!batchModalProduct?.trackSerial && (
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Quantity</label>
                        <input type="number" required className="nexora-input" value={batchForm.qty} onChange={e => setBatchForm({...batchForm, qty: e.target.value})} placeholder="e.g. 50" />
                      </div>
                    )}
                  </div>
                  {batchModalProduct?.trackSerial && (
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">
                        Serial Numbers (one per line) — {batchForm.serials.split("\n").map(s => s.trim()).filter(Boolean).length} units
                      </label>
                      <textarea
                        className="nexora-input resize-none font-mono text-xs"
                        rows={5}
                        required
                        value={batchForm.serials}
                        onChange={e => setBatchForm({...batchForm, serials: e.target.value})}
                        placeholder={"e.g.\nSN-0001\nSN-0002\nSN-0003"}
                      />
                    </div>
                  )}
                  {batchError && <p className="text-xs text-red-500">{batchError}</p>}
                  <input className="nexora-input" placeholder="Note (optional)" value={batchForm.note} onChange={e => setBatchForm({...batchForm, note: e.target.value})} />
                  <button type="submit" disabled={addingBatch} className="nexora-btn nexora-btn-primary w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed">
                    <Plus size={14} /> {addingBatch ? "Adding…" : "Add Batch"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Serials Modal */}
      {manageSerialsBatch && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl w-full max-w-sm max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 shrink-0">
              <div>
                <h2 className="font-prata text-lg text-black">Serial Numbers</h2>
                <p className="text-xs text-zinc-400">{editingBatchUnits.length} units in this batch</p>
              </div>
              <button onClick={() => { setManageSerialsBatch(null); setEditingBatchUnits([]); setUnitActionError(""); }} className="text-zinc-400 hover:text-black">
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0 space-y-3">
              <div className="space-y-1.5">
                {editingBatchUnits.length === 0 ? (
                  <p className="text-xs text-zinc-400 text-center py-3">No serials yet</p>
                ) : (
                  editingBatchUnits.map(u => (
                    <div key={u.id} className="flex items-center gap-2">
                      {u.status === "sold" ? (
                        <>
                          <span className="nexora-input flex-1 text-zinc-400 font-mono text-xs py-1.5">{u.serialNumber}</span>
                          <span className="badge badge-default text-xs shrink-0">sold</span>
                        </>
                      ) : (
                        <>
                          <input
                            className="nexora-input flex-1 font-mono text-xs py-1.5"
                            defaultValue={u.serialNumber}
                            onBlur={e => e.target.value.trim() !== u.serialNumber && handleSaveUnitSerial(u.id, e.target.value)}
                          />
                          <button type="button" onClick={() => handleDeleteUnit(u.id, manageSerialsBatch.id, u.serialNumber)} className="text-zinc-300 hover:text-red-500 shrink-0">
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
              <div className="border-t border-zinc-100 pt-3 space-y-2">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Add More Serials</p>
                <textarea
                  className="nexora-input resize-none font-mono text-xs"
                  rows={3}
                  placeholder={"One per line…"}
                  value={newSerialsForBatch}
                  onChange={e => setNewSerialsForBatch(e.target.value)}
                />
                {unitActionError && <p className="text-xs text-red-500">{unitActionError}</p>}
                <button type="button" disabled={addingSerials} onClick={() => handleAddSerialsToBatch(manageSerialsBatch.id)} className="nexora-btn nexora-btn-outline w-full justify-center text-xs py-1.5 disabled:opacity-60 disabled:cursor-not-allowed">
                  <Plus size={12} /> {addingSerials ? "Adding…" : "Add Serials"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete product?"
        message="This product and its batch history will be permanently removed. This action cannot be undone."
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      <ConfirmDialog
        open={!!deleteUnitTarget}
        title="Remove this unit?"
        message={deleteUnitTarget ? `Serial "${deleteUnitTarget.serialNumber}" will be removed from stock. This can't be undone.` : ""}
        loading={deletingUnit}
        onConfirm={confirmDeleteUnit}
        onCancel={() => setDeleteUnitTarget(null)}
      />
    </div>
  );
}
