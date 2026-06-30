"use client";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { addSupplier, getSuppliers, getShopSettings, updateShopSettings } from "@/lib/firestore";
import { useEffect } from "react";
import { Plus, X, Store, Truck } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: "", phone: "", email: "", address: "" });
  const [shopForm, setShopForm] = useState({ name: "", phone: "", email: "", address: "" });
  const [savingShop, setSavingShop] = useState(false);
  const [shopSaved, setShopSaved] = useState(false);

  useEffect(() => {
    getSuppliers().then(setSuppliers);
    getShopSettings().then((s) => {
      if (s) setShopForm({ name: s.name || "", phone: s.phone || "", email: s.email || "", address: s.address || "" });
    });
  }, []);

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    await addSupplier(supplierForm);
    setShowSupplierModal(false);
    setSupplierForm({ name: "", phone: "", email: "", address: "" });
    getSuppliers().then(setSuppliers);
  };

  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingShop(true);
    await updateShopSettings(shopForm);
    setSavingShop(false);
    setShopSaved(true);
    setTimeout(() => setShopSaved(false), 2000);
  };

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="font-prata text-2xl text-black">Settings</h1>
        <p className="text-zinc-500 text-sm mt-1">Manage shop info and suppliers</p>
      </div>

      {/* Shop info */}
      <div className="nexora-card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Store size={16} className="text-zinc-400" />
          <h2 className="font-prata text-base text-black">Shop Info</h2>
        </div>
        <p className="text-xs text-zinc-400 mb-4">
          These details are printed on every bill. "Nexora" is just the system's name — set your own shop name, phone, email and address below.
        </p>
        <form onSubmit={handleSaveShop} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className="nexora-input" required placeholder="Shop name" value={shopForm.name} onChange={e => setShopForm({ ...shopForm, name: e.target.value })} />
            <input className="nexora-input" required placeholder="Phone" value={shopForm.phone} onChange={e => setShopForm({ ...shopForm, phone: e.target.value })} />
            <input className="nexora-input" placeholder="Email" value={shopForm.email} onChange={e => setShopForm({ ...shopForm, email: e.target.value })} />
            <input className="nexora-input" placeholder="Address" value={shopForm.address} onChange={e => setShopForm({ ...shopForm, address: e.target.value })} />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={savingShop} className="nexora-btn nexora-btn-primary text-xs py-1.5 px-3">
              {savingShop ? "Saving..." : "Save Shop Info"}
            </button>
            {shopSaved && <span className="text-xs text-green-600">Saved</span>}
          </div>
        </form>
        <div className="mt-4 pt-4 border-t border-zinc-100">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Logged in as</p>
          <p className="text-sm font-medium text-black">{user?.email}</p>
        </div>
      </div>

      {/* Suppliers */}
      <div className="nexora-card overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <Truck size={16} className="text-zinc-400" />
            <h2 className="font-prata text-base text-black">Suppliers</h2>
          </div>
          <button onClick={() => setShowSupplierModal(true)} className="nexora-btn nexora-btn-primary text-xs py-1.5 px-3 self-start sm:self-auto">
            <Plus size={12} /> Add Supplier
          </button>
        </div>
        <div className="divide-y divide-zinc-50">
          {suppliers.length === 0 ? (
            <p className="text-center py-8 text-sm text-zinc-400">No suppliers added</p>
          ) : (
            suppliers.map((s) => (
              <div key={s.id} className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 hover:bg-zinc-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-black">{s.name}</p>
                  <p className="text-xs text-zinc-400">{s.phone} {s.email ? `· ${s.email}` : ""}</p>
                </div>
                {s.address && <p className="text-xs text-zinc-400">{s.address}</p>}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Firebase collections reference */}
      <div className="nexora-card p-6 mt-6">
        <h2 className="font-prata text-base text-black mb-4">Firebase Collections</h2>
        <div className="space-y-1.5">
          {[
            ["shopSettings/main", "Shop name, phone, email, address shown on bills"],
            ["brands", "Product brands"],
            ["main_categories", "Main product categories"],
            ["sub_categories", "Sub categories (linked to main)"],
            ["products", "Products with batch subcollection"],
            ["products/{id}/batches", "Cost price batches per product"],
            ["customers", "Customer profiles"],
            ["suppliers", "Suppliers"],
            ["sales", "Sale headers"],
            ["sales/{id}/saleItems", "Line items per sale"],
            ["warranties", "Warranty records"],
            ["stock_movements", "Full audit trail"],
            ["counters/invoice", "Auto invoice number"],
          ].map(([col, desc]) => (
            <div key={col} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm py-1">
              <code className="bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded text-xs font-mono sm:w-52 shrink-0 inline-block">{col}</code>
              <span className="text-zinc-500">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Supplier modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h2 className="font-prata text-lg">Add Supplier</h2>
              <button onClick={() => setShowSupplierModal(false)}><X size={16} className="text-zinc-400" /></button>
            </div>
            <form onSubmit={handleAddSupplier} className="px-6 py-4 space-y-3">
              <input className="nexora-input" required placeholder="Supplier name" value={supplierForm.name} onChange={e => setSupplierForm({...supplierForm, name: e.target.value})} />
              <input className="nexora-input" required placeholder="Phone" value={supplierForm.phone} onChange={e => setSupplierForm({...supplierForm, phone: e.target.value})} />
              <input className="nexora-input" placeholder="Email" value={supplierForm.email} onChange={e => setSupplierForm({...supplierForm, email: e.target.value})} />
              <input className="nexora-input" placeholder="Address" value={supplierForm.address} onChange={e => setSupplierForm({...supplierForm, address: e.target.value})} />
              <button type="submit" className="nexora-btn nexora-btn-primary w-full justify-center">Add Supplier</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
