"use client";
import { useEffect, useState } from "react";
import { getCustomers, addCustomer, updateCustomer } from "@/lib/firestore";
import { Customer } from "@/types";
import { Plus, Edit2, X, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import AccessRestricted from "@/components/ui/AccessRestricted";

export default function CustomersPage() {
  const { can } = useAuth();
  const canView = can("customers.view");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" });

  useEffect(() => { load(); }, []);

  async function load() {
    const data = await getCustomers();
    setCustomers(data as Customer[]);
  }

  const openAdd = () => { setEditing(null); setForm({ name: "", phone: "", email: "", address: "" }); setShowModal(true); };
  const openEdit = (c: Customer) => { setEditing(c); setForm({ name: c.name, phone: c.phone, email: c.email || "", address: c.address || "" }); setShowModal(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) await updateCustomer(editing.id, form);
    else await addCustomer(form);
    setShowModal(false);
    load();
  };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  );

  if (!canView) return <AccessRestricted message="You don't have permission to view Customers." />;

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-prata text-2xl text-black">Customers</h1>
          <p className="text-zinc-500 text-sm mt-1">{customers.length} customers</p>
        </div>
        <button onClick={openAdd} className="nexora-btn nexora-btn-primary self-start sm:self-auto">
          <Plus size={14} /> Add Customer
        </button>
      </div>

      <div className="relative mb-4 sm:max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          className="nexora-input pl-9"
          placeholder="Search by name or phone"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="nexora-card overflow-hidden">
        <div className="divide-y divide-zinc-50">
          {filtered.length === 0 ? (
            <p className="text-center py-12 text-sm text-zinc-400">No customers found</p>
          ) : (
            filtered.map(c => (
              <div key={c.id} className="px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-zinc-50 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-black">{c.name}</p>
                  <p className="text-xs text-zinc-400">{c.phone} {c.email ? `· ${c.email}` : ""}</p>
                  {c.address && <p className="text-xs text-zinc-400">{c.address}</p>}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-zinc-500">{c.loyaltyPoints || 0} pts</span>
                  <button onClick={() => openEdit(c)} className="nexora-btn nexora-btn-ghost p-1.5"><Edit2 size={12} /></button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h2 className="font-prata text-lg">{editing ? "Edit Customer" : "Add Customer"}</h2>
              <button onClick={() => setShowModal(false)}><X size={16} className="text-zinc-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3">
              <input className="nexora-input" required placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input className="nexora-input" required placeholder="Phone number" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <input className="nexora-input" placeholder="Email (optional)" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              <input className="nexora-input" placeholder="Address (optional)" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              <button type="submit" className="nexora-btn nexora-btn-primary w-full justify-center">{editing ? "Update Customer" : "Add Customer"}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
