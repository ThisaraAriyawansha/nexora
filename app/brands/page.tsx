"use client";
import { useEffect, useState } from "react";
import { getBrands, addBrand, updateBrand, deleteBrand } from "@/lib/firestore";
import { Brand } from "@/types";
import { Plus, Edit2, Trash2, X } from "lucide-react";

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });

  useEffect(() => { load(); }, []);

  async function load() {
    const data = await getBrands();
    setBrands(data as Brand[]);
  }

  const openAdd = () => { setEditing(null); setForm({ name: "", description: "" }); setShowModal(true); };
  const openEdit = (b: Brand) => { setEditing(b); setForm({ name: b.name, description: b.description || "" }); setShowModal(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) await updateBrand(editing.id, form);
    else await addBrand(form);
    setShowModal(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete brand?")) return;
    await deleteBrand(id);
    load();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-prata text-2xl text-black">Brands</h1>
          <p className="text-zinc-500 text-sm mt-1">{brands.length} brands</p>
        </div>
        <button onClick={openAdd} className="nexora-btn nexora-btn-primary">
          <Plus size={14} /> Add Brand
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {brands.map(brand => (
          <div key={brand.id} className="nexora-card p-4 flex items-start justify-between">
            <div>
              <p className="font-medium text-black text-sm">{brand.name}</p>
              {brand.description && <p className="text-xs text-zinc-400 mt-0.5">{brand.description}</p>}
            </div>
            <div className="flex gap-1 ml-2">
              <button onClick={() => openEdit(brand)} className="nexora-btn nexora-btn-ghost p-1.5"><Edit2 size={12} /></button>
              <button onClick={() => handleDelete(brand.id)} className="nexora-btn nexora-btn-ghost p-1.5 text-red-500"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
        {brands.length === 0 && (
          <div className="col-span-4 text-center py-12 text-zinc-400 text-sm">No brands yet. Add your first brand.</div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h2 className="font-prata text-lg">{editing ? "Edit Brand" : "Add Brand"}</h2>
              <button onClick={() => setShowModal(false)}><X size={16} className="text-zinc-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Brand Name</label>
                <input className="nexora-input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Description</label>
                <input className="nexora-input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="nexora-btn nexora-btn-primary flex-1 justify-center">{editing ? "Update" : "Add"}</button>
                <button type="button" onClick={() => setShowModal(false)} className="nexora-btn nexora-btn-outline">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
