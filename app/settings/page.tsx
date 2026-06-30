"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  addSupplier, updateSupplier, getSuppliers, getShopSettings, updateShopSettings,
  createTeamUser, getTeamUsers, updateTeamUser,
} from "@/lib/firestore";
import { Plus, X, Store, Truck, Users, CheckCircle, AlertCircle, Pencil, ToggleLeft, ToggleRight } from "lucide-react";
import { UserProfile } from "@/types";

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name && name.trim()) {
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0][0].toUpperCase();
  }
  return email ? email[0].toUpperCase() : "U";
}

export default function SettingsPage() {
  const { user, userRole } = useAuth();
  const isSuperAdmin = userRole === "Super Admin";
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: "", phone: "", email: "", address: "" });
  const [shopForm, setShopForm] = useState({ name: "", phone: "", email: "", address: "" });
  const [savingShop, setSavingShop] = useState(false);
  const [shopSaved, setShopSaved] = useState(false);

  const [teamUsers, setTeamUsers] = useState<UserProfile[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ displayName: "", email: "", password: "", confirmPassword: "", role: "Admin" });
  const [addingUser, setAddingUser] = useState(false);
  const [userMsg, setUserMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
  const [supplierEditForm, setSupplierEditForm] = useState({ name: "", phone: "", email: "", address: "" });
  const [savingSupplier, setSavingSupplier] = useState(false);

  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState({ displayName: "", role: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editMsg, setEditMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [togglingUid, setTogglingUid] = useState<string | null>(null);

  useEffect(() => {
    getSuppliers().then(setSuppliers);
    getShopSettings().then((s) => {
      if (s) setShopForm({ name: s.name || "", phone: s.phone || "", email: s.email || "", address: s.address || "" });
    });
    getTeamUsers().then(setTeamUsers);
  }, []);

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    await addSupplier(supplierForm);
    setShowSupplierModal(false);
    setSupplierForm({ name: "", phone: "", email: "", address: "" });
    getSuppliers().then(setSuppliers);
  };

  const openEditSupplier = (s: any) => {
    setEditingSupplier(s);
    setSupplierEditForm({ name: s.name || "", phone: s.phone || "", email: s.email || "", address: s.address || "" });
  };

  const handleEditSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier) return;
    setSavingSupplier(true);
    await updateSupplier(editingSupplier.id, supplierEditForm);
    setSuppliers((prev) => prev.map((s) => s.id === editingSupplier.id ? { ...s, ...supplierEditForm } : s));
    setSavingSupplier(false);
    setEditingSupplier(null);
  };

  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingShop(true);
    await updateShopSettings(shopForm);
    setSavingShop(false);
    setShopSaved(true);
    setTimeout(() => setShopSaved(false), 2000);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserMsg(null);
    if (userForm.password !== userForm.confirmPassword) {
      setUserMsg({ type: "error", text: "Passwords do not match." });
      return;
    }
    if (userForm.password.length < 6) {
      setUserMsg({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }
    setAddingUser(true);
    try {
      await createTeamUser(userForm.email, userForm.password, userForm.displayName, userForm.role);
      setUserMsg({ type: "success", text: `${userForm.displayName || userForm.email} added successfully.` });
      setUserForm({ displayName: "", email: "", password: "", confirmPassword: "", role: "Admin" });
      getTeamUsers().then(setTeamUsers);
      setTimeout(() => {
        setShowAddUserModal(false);
        setUserMsg(null);
      }, 1500);
    } catch (err: any) {
      const msg =
        err?.code === "auth/email-already-in-use"
          ? "An account with that email already exists."
          : err?.code === "auth/invalid-email"
          ? "Invalid email address."
          : err?.code === "auth/weak-password"
          ? "Password is too weak."
          : "Failed to create user. Please try again.";
      setUserMsg({ type: "error", text: msg });
    } finally {
      setAddingUser(false);
    }
  };

  const openEditModal = (u: UserProfile) => {
    setEditingUser(u);
    setEditForm({ displayName: u.displayName, role: u.role });
    setEditMsg(null);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);
    setEditMsg(null);
    try {
      await updateTeamUser(editingUser.uid, { displayName: editForm.displayName, role: editForm.role });
      setTeamUsers((prev) =>
        prev.map((u) => u.uid === editingUser.uid ? { ...u, displayName: editForm.displayName, role: editForm.role } : u)
      );
      setEditMsg({ type: "success", text: "Updated successfully." });
      setTimeout(() => { setEditingUser(null); setEditMsg(null); }, 1000);
    } catch {
      setEditMsg({ type: "error", text: "Failed to update. Please try again." });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleStatus = async (u: UserProfile) => {
    if (u.uid === user?.uid) return;
    setTogglingUid(u.uid);
    const newStatus = u.status === "inactive" ? "active" : "inactive";
    try {
      await updateTeamUser(u.uid, { status: newStatus });
      setTeamUsers((prev) =>
        prev.map((t) => t.uid === u.uid ? { ...t, status: newStatus } : t)
      );
    } finally {
      setTogglingUid(null);
    }
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="font-prata text-2xl text-black">Settings</h1>
        <p className="text-zinc-500 text-sm mt-1">Manage shop info, team, and suppliers</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        {/* Left: Shop Info */}
        <div className="lg:col-span-3">
          <div className="nexora-card p-4 sm:p-6">
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
        </div>

        {/* Right: Suppliers */}
        <div className="lg:col-span-2">
          <div className="nexora-card overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-4 border-b border-zinc-100">
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
                  <div key={s.id} className="px-4 sm:px-6 py-3.5 flex items-center gap-3 hover:bg-zinc-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-black">{s.name}</p>
                      <p className="text-xs text-zinc-400">{s.phone} {s.email ? `· ${s.email}` : ""}</p>
                    </div>
                    {s.address && <p className="text-xs text-zinc-400 shrink-0">{s.address}</p>}
                    <button
                      onClick={() => openEditSupplier(s)}
                      className="p-1.5 rounded hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 transition-colors shrink-0"
                      title="Edit supplier"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Team */}
      <div className="nexora-card overflow-hidden mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <Users size={16} className="text-zinc-400" />
            <div>
              <h2 className="font-prata text-base text-black">Team</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Users who can log in to Nexora POS</p>
            </div>
          </div>
          {isSuperAdmin && (
            <button
              onClick={() => { setShowAddUserModal(true); setUserMsg(null); }}
              className="nexora-btn nexora-btn-primary text-xs py-1.5 px-3 self-start sm:self-auto"
            >
              <Plus size={12} /> Add User
            </button>
          )}
        </div>
        <div className="divide-y divide-zinc-50">
          {teamUsers.length === 0 ? (
            <p className="text-center py-8 text-sm text-zinc-400">
              No users yet — add one to get started
            </p>
          ) : (
            teamUsers.map((u) => {
              const isInactive = u.status === "inactive";
              const isSelf = u.uid === user?.uid;
              return (
                <div key={u.uid} className={`px-4 sm:px-6 py-3.5 flex items-center gap-3 transition-colors ${isInactive ? "opacity-50 bg-zinc-50" : "hover:bg-zinc-50"}`}>
                  <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                    <span className="text-zinc-600 text-xs font-prata">
                      {getInitials(u.displayName, u.email)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-black truncate">{u.displayName || "—"}</p>
                    <p className="text-xs text-zinc-400 truncate">{u.email}</p>
                  </div>
                  <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded font-poppins shrink-0">
                    {u.role}
                  </span>
                  {isInactive && (
                    <span className="text-xs bg-red-50 text-red-400 px-2 py-0.5 rounded font-poppins shrink-0">
                      Disabled
                    </span>
                  )}
                  {isSuperAdmin && (
                    <button
                      onClick={() => openEditModal(u)}
                      className="p-1.5 rounded hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 transition-colors shrink-0"
                      title="Edit user"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                  {isSuperAdmin && !isSelf && (
                    <button
                      onClick={() => handleToggleStatus(u)}
                      disabled={togglingUid === u.uid}
                      className={`p-1.5 rounded transition-colors shrink-0 ${isInactive ? "text-zinc-300 hover:text-green-500 hover:bg-green-50" : "text-zinc-400 hover:text-red-500 hover:bg-red-50"}`}
                      title={isInactive ? "Enable user" : "Disable user"}
                    >
                      {isInactive ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Firebase collections reference */}
      <div className="nexora-card p-4 sm:p-6">
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

      {/* Edit Supplier modal */}
      {editingSupplier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h2 className="font-prata text-lg">Edit Supplier</h2>
              <button onClick={() => setEditingSupplier(null)}><X size={16} className="text-zinc-400" /></button>
            </div>
            <form onSubmit={handleEditSupplier} className="px-6 py-4 space-y-3">
              <input className="nexora-input" required placeholder="Supplier name" value={supplierEditForm.name} onChange={e => setSupplierEditForm({ ...supplierEditForm, name: e.target.value })} />
              <input className="nexora-input" required placeholder="Phone" value={supplierEditForm.phone} onChange={e => setSupplierEditForm({ ...supplierEditForm, phone: e.target.value })} />
              <input className="nexora-input" placeholder="Email" value={supplierEditForm.email} onChange={e => setSupplierEditForm({ ...supplierEditForm, email: e.target.value })} />
              <input className="nexora-input" placeholder="Address" value={supplierEditForm.address} onChange={e => setSupplierEditForm({ ...supplierEditForm, address: e.target.value })} />
              <button type="submit" disabled={savingSupplier} className="nexora-btn nexora-btn-primary w-full justify-center">
                {savingSupplier ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit User modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h2 className="font-prata text-lg">Edit User</h2>
              <button onClick={() => setEditingUser(null)}><X size={16} className="text-zinc-400" /></button>
            </div>
            <form onSubmit={handleEditUser} className="px-6 py-4 space-y-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Full Name</label>
                <input
                  className="nexora-input"
                  required
                  value={editForm.displayName}
                  onChange={e => setEditForm({ ...editForm, displayName: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Email</label>
                <input className="nexora-input opacity-60 cursor-not-allowed" value={editingUser.email || ""} readOnly tabIndex={-1} />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Role</label>
                <select
                  className="nexora-input"
                  value={editForm.role}
                  onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                >
                  <option value="Super Admin">Super Admin</option>
                  <option value="Admin">Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="Cashier">Cashier</option>
                </select>
              </div>
              {editMsg && (
                <p className={`flex items-center gap-1.5 text-xs ${editMsg.type === "success" ? "text-green-600" : "text-red-500"}`}>
                  {editMsg.type === "success" ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                  {editMsg.text}
                </p>
              )}
              <button
                type="submit"
                disabled={savingEdit}
                className="nexora-btn nexora-btn-primary w-full justify-center"
              >
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add User modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h2 className="font-prata text-lg">Add User</h2>
              <button onClick={() => setShowAddUserModal(false)}><X size={16} className="text-zinc-400" /></button>
            </div>
            <form onSubmit={handleAddUser} className="px-6 py-4 space-y-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Full Name</label>
                <input
                  className="nexora-input"
                  required
                  placeholder="e.g. Kasun Perera"
                  value={userForm.displayName}
                  onChange={e => setUserForm({ ...userForm, displayName: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Email</label>
                <input
                  type="email"
                  className="nexora-input"
                  required
                  placeholder="user@email.com"
                  value={userForm.email}
                  onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Role</label>
                <select
                  className="nexora-input"
                  value={userForm.role}
                  onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                >
                  <option value="Super Admin">Super Admin</option>
                  <option value="Admin">Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="Cashier">Cashier</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Password</label>
                <input
                  type="password"
                  className="nexora-input"
                  required
                  placeholder="At least 6 characters"
                  value={userForm.password}
                  onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Confirm Password</label>
                <input
                  type="password"
                  className="nexora-input"
                  required
                  placeholder="Repeat password"
                  value={userForm.confirmPassword}
                  onChange={e => setUserForm({ ...userForm, confirmPassword: e.target.value })}
                />
              </div>
              {userMsg && (
                <p className={`flex items-center gap-1.5 text-xs ${userMsg.type === "success" ? "text-green-600" : "text-red-500"}`}>
                  {userMsg.type === "success" ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                  {userMsg.text}
                </p>
              )}
              <button
                type="submit"
                disabled={addingUser}
                className="nexora-btn nexora-btn-primary w-full justify-center"
              >
                {addingUser ? "Creating..." : "Create User"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
