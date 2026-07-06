"use client";
import { useEffect, useState } from "react";
import {
  getMainCategories, addMainCategory, updateMainCategory, deleteMainCategory,
  getSubCategories, addSubCategory, updateSubCategory, deleteSubCategory,
} from "@/lib/firestore";
import { MainCategory, SubCategory } from "@/types";
import { Plus, Edit2, Trash2, X, ChevronRight } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

export default function CategoriesPage() {
  const [mainCats, setMainCats] = useState<MainCategory[]>([]);
  const [subCats, setSubCats] = useState<SubCategory[]>([]);
  const [selectedMain, setSelectedMain] = useState<MainCategory | null>(null);
  const [showMainModal, setShowMainModal] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [editingMain, setEditingMain] = useState<MainCategory | null>(null);
  const [editingSub, setEditingSub] = useState<SubCategory | null>(null);
  const [mainForm, setMainForm] = useState({ name: "", description: "" });
  const [subForm, setSubForm] = useState({ name: "", description: "" });
  const [deleteMainId, setDeleteMainId] = useState<string | null>(null);
  const [deleteSubId, setDeleteSubId] = useState<string | null>(null);
  const [deletingMain, setDeletingMain] = useState(false);
  const [deletingSub, setDeletingSub] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const [m, s] = await Promise.all([getMainCategories(), getSubCategories()]);
    setMainCats(m as MainCategory[]);
    setSubCats(s as SubCategory[]);
    if (selectedMain) setSelectedMain(m.find((c: any) => c.id === selectedMain.id) as MainCategory || null);
  }

  const filteredSubs = subCats.filter(s => s.mainCategoryId === selectedMain?.id);

  const handleMainSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMain) await updateMainCategory(editingMain.id, mainForm);
    else await addMainCategory(mainForm);
    setShowMainModal(false);
    load();
  };

  const handleSubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSub) await updateSubCategory(editingSub.id, subForm);
    else await addSubCategory({ ...subForm, mainCategoryId: selectedMain!.id });
    setShowSubModal(false);
    load();
  };

  const deleteMain = async () => {
    if (!deleteMainId) return;
    setDeletingMain(true);
    try {
      await deleteMainCategory(deleteMainId);
      if (selectedMain?.id === deleteMainId) setSelectedMain(null);
      setDeleteMainId(null);
      load();
    } finally {
      setDeletingMain(false);
    }
  };

  const deleteSub = async () => {
    if (!deleteSubId) return;
    setDeletingSub(true);
    try {
      await deleteSubCategory(deleteSubId);
      setDeleteSubId(null);
      load();
    } finally {
      setDeletingSub(false);
    }
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="font-prata text-2xl text-black">Categories</h1>
        <p className="text-zinc-500 text-sm mt-1">Manage main categories and subcategories</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Main Categories */}
        <div className="nexora-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
            <p className="font-prata text-base text-black">Main Categories</p>
            <button onClick={() => { setEditingMain(null); setMainForm({ name: "", description: "" }); setShowMainModal(true); }}
              className="nexora-btn nexora-btn-primary text-xs py-1.5 px-3">
              <Plus size={12} /> Add
            </button>
          </div>
          <div className="divide-y divide-zinc-50">
            {mainCats.length === 0 && (
              <p className="text-center py-8 text-sm text-zinc-400">No categories</p>
            )}
            {mainCats.map(cat => (
              <div
                key={cat.id}
                onClick={() => setSelectedMain(cat)}
                className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${selectedMain?.id === cat.id ? "bg-black text-white" : "hover:bg-zinc-50"}`}
              >
                <div className="flex items-center gap-2">
                  <ChevronRight size={13} className={selectedMain?.id === cat.id ? "text-white" : "text-zinc-400"} />
                  <span className="text-sm font-medium">{cat.name}</span>
                </div>
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setEditingMain(cat); setMainForm({ name: cat.name, description: cat.description || "" }); setShowMainModal(true); }}
                    className={`p-1.5 rounded hover:bg-zinc-200 transition-colors ${selectedMain?.id === cat.id ? "text-white hover:bg-zinc-700" : "text-zinc-400"}`}>
                    <Edit2 size={11} />
                  </button>
                  <button onClick={() => setDeleteMainId(cat.id)}
                    className={`p-1.5 rounded hover:bg-red-100 transition-colors ${selectedMain?.id === cat.id ? "text-red-300 hover:text-red-600" : "text-zinc-400 hover:text-red-500"}`}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sub Categories */}
        <div className="nexora-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
            <p className="font-prata text-base text-black">
              {selectedMain ? `${selectedMain.name} — Subcategories` : "Subcategories"}
            </p>
            {selectedMain && (
              <button onClick={() => { setEditingSub(null); setSubForm({ name: "", description: "" }); setShowSubModal(true); }}
                className="nexora-btn nexora-btn-primary text-xs py-1.5 px-3">
                <Plus size={12} /> Add
              </button>
            )}
          </div>
          <div className="divide-y divide-zinc-50">
            {!selectedMain && (
              <p className="text-center py-8 text-sm text-zinc-400">Select a main category</p>
            )}
            {selectedMain && filteredSubs.length === 0 && (
              <p className="text-center py-8 text-sm text-zinc-400">No subcategories yet</p>
            )}
            {filteredSubs.map(sub => (
              <div key={sub.id} className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors">
                <span className="text-sm font-medium text-black">{sub.name}</span>
                <div className="flex gap-1">
                  <button onClick={() => { setEditingSub(sub); setSubForm({ name: sub.name, description: sub.description || "" }); setShowSubModal(true); }}
                    className="p-1.5 rounded text-zinc-400 hover:text-black hover:bg-zinc-100 transition-colors">
                    <Edit2 size={11} />
                  </button>
                  <button onClick={() => setDeleteSubId(sub.id)}
                    className="p-1.5 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Cat Modal */}
      {showMainModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h2 className="font-prata text-lg">{editingMain ? "Edit Category" : "Add Main Category"}</h2>
              <button onClick={() => setShowMainModal(false)}><X size={16} className="text-zinc-400" /></button>
            </div>
            <form onSubmit={handleMainSubmit} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Name</label>
                <input className="nexora-input" required value={mainForm.name} onChange={e => setMainForm({...mainForm, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Description</label>
                <input className="nexora-input" value={mainForm.description} onChange={e => setMainForm({...mainForm, description: e.target.value})} />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="nexora-btn nexora-btn-primary flex-1 justify-center">{editingMain ? "Update" : "Add"}</button>
                <button type="button" onClick={() => setShowMainModal(false)} className="nexora-btn nexora-btn-outline">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sub Cat Modal */}
      {showSubModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h2 className="font-prata text-lg">{editingSub ? "Edit Subcategory" : "Add Subcategory"}</h2>
              <button onClick={() => setShowSubModal(false)}><X size={16} className="text-zinc-400" /></button>
            </div>
            <form onSubmit={handleSubSubmit} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Name</label>
                <input className="nexora-input" required value={subForm.name} onChange={e => setSubForm({...subForm, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1.5">Description</label>
                <input className="nexora-input" value={subForm.description} onChange={e => setSubForm({...subForm, description: e.target.value})} />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="nexora-btn nexora-btn-primary flex-1 justify-center">{editingSub ? "Update" : "Add"}</button>
                <button type="button" onClick={() => setShowSubModal(false)} className="nexora-btn nexora-btn-outline">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteMainId}
        title="Delete category?"
        message="This category and its subcategories may be affected. This action cannot be undone."
        loading={deletingMain}
        onConfirm={deleteMain}
        onCancel={() => setDeleteMainId(null)}
      />

      <ConfirmDialog
        open={!!deleteSubId}
        title="Delete subcategory?"
        message="This subcategory will be permanently removed. This action cannot be undone."
        loading={deletingSub}
        onConfirm={deleteSub}
        onCancel={() => setDeleteSubId(null)}
      />
    </div>
  );
}
