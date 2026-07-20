"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getShopSettings, updateShopSettings,
  createTeamUser, getTeamUsers, updateTeamUser, getUsageStats, CollectionStat, cleanCollection,
  getCollectionData, migrateStockToLocations, getStockLocationMigrationStatus, backfillUserPermissions,
} from "@/lib/firestore";
import { Plus, X, Store, Users, CheckCircle, AlertCircle, Pencil, ToggleLeft, ToggleRight, Database, HardDrive, BookOpen, PenLine, Trash2, AlertTriangle, Download, Loader2, BellRing, Boxes, ShieldCheck } from "lucide-react";
import { UserProfile } from "@/types";
import { rowsToCSV, downloadCSV } from "@/lib/csv";
import { PermissionKey, PERMISSION_CATALOG, getDefaultPermissions, isEditableRole, canManagePermissionsFor } from "@/lib/permissions";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(3)} GB`;
}

function barColor(pct: number): string {
  if (pct >= 80) return "bg-red-500";
  if (pct >= 60) return "bg-amber-400";
  return "bg-black";
}

function UsageBar({ label, used, total, usedLabel, totalLabel, icon: Icon }: {
  label: string; used: number; total: number;
  usedLabel: string; totalLabel: string;
  icon: React.ElementType;
}) {
  const pct = Math.min((used / total) * 100, 100);
  const color = barColor(pct);
  const statusColor = pct >= 80 ? "text-red-500" : pct >= 60 ? "text-amber-500" : "text-green-600";
  const statusText = pct >= 80 ? "Critical" : pct >= 60 ? "Watch out" : "Safe";
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <Icon size={13} className="text-zinc-400" />
          <span className="text-sm font-medium text-black">{label}</span>
        </div>
        <span className={`text-xs font-medium ${statusColor}`}>{statusText}</span>
      </div>
      <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.max(pct, 0.5)}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-zinc-500">{usedLabel}</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${statusColor}`}>{pct.toFixed(1)}%</span>
          <span className="text-xs text-zinc-400">of {totalLabel}</span>
        </div>
      </div>
    </div>
  );
}

const PERMISSION_MODULES: { module: string; keys: PermissionKey[] }[] = (() => {
  const order: string[] = [];
  const byModule = new Map<string, PermissionKey[]>();
  for (const def of PERMISSION_CATALOG) {
    if (!byModule.has(def.module)) { byModule.set(def.module, []); order.push(def.module); }
    byModule.get(def.module)!.push(def.key);
  }
  return order.map((module) => ({ module, keys: byModule.get(module)! }));
})();

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
  const canClean = userRole === "Super Admin" || userRole === "Admin";
  const [shopForm, setShopForm] = useState({ name: "", phone: "", email: "", address: "" });
  const [savingShop, setSavingShop] = useState(false);
  const [shopSaved, setShopSaved] = useState(false);

  const [notifyEmails, setNotifyEmails] = useState<string[]>([]);
  const [notifyEmailInput, setNotifyEmailInput] = useState("");
  const [notifyEmailError, setNotifyEmailError] = useState("");
  const [savingNotifyEmails, setSavingNotifyEmails] = useState(false);
  const [notifyEmailsSaved, setNotifyEmailsSaved] = useState(false);

  const [teamUsers, setTeamUsers] = useState<UserProfile[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ displayName: "", email: "", password: "", confirmPassword: "", role: "Admin" });
  const [addingUser, setAddingUser] = useState(false);
  const [userMsg, setUserMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState<{ displayName: string; role: string; permissions: Record<PermissionKey, boolean> }>({
    displayName: "", role: "", permissions: getDefaultPermissions("Admin"),
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editMsg, setEditMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [togglingUid, setTogglingUid] = useState<string | null>(null);
  const [usageStats, setUsageStats] = useState<CollectionStat[]>([]);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [showCleanModal, setShowCleanModal] = useState(false);
  const [cleanTarget, setCleanTarget] = useState<CollectionStat | null>(null);
  const [cleanConfirm, setCleanConfirm] = useState("");
  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<{ count: number } | null>(null);
  const [exportingKey, setExportingKey] = useState<string | null>(null);

  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{ usersTouched: number } | null>(null);

  const [migrationStatus, setMigrationStatus] = useState<{ done: boolean; migratedAt?: any; migratedByName?: string } | null>(null);
  const [loadingMigrationStatus, setLoadingMigrationStatus] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{ productsTouched: number; batchesTouched: number; unitsTouched: number } | null>(null);
  const [migrationError, setMigrationError] = useState("");

  const handleExportCSV = async (c: CollectionStat) => {
    if (!canClean) return;
    setExportingKey(c.key);
    try {
      const rows = await getCollectionData(c.key);
      const csv = rowsToCSV(rows);
      downloadCSV(`${c.key}.csv`, csv);
    } finally {
      setExportingKey(null);
    }
  };

  useEffect(() => {
    getShopSettings().then((s) => {
      if (s) {
        setShopForm({ name: s.name || "", phone: s.phone || "", email: s.email || "", address: s.address || "" });
        setNotifyEmails(s.notifyEmails || []);
      }
    });
    // Listing every team account and counting the "users" collection require
    // Admin+ under Firestore rules — skip them entirely for Cashier/Manager
    // instead of letting the denied read reject and crash the page.
    if (canClean) {
      getTeamUsers().then(setTeamUsers);
      getUsageStats().then((s) => { setUsageStats(s); setLoadingUsage(false); });
    } else {
      setLoadingUsage(false);
    }
    if (isSuperAdmin) {
      getStockLocationMigrationStatus().then((s) => { setMigrationStatus(s); setLoadingMigrationStatus(false); });
    } else {
      setLoadingMigrationStatus(false);
    }
  }, [canClean, isSuperAdmin]);

  const handleMigrateStock = async () => {
    if (!isSuperAdmin || migrating || migrationStatus?.done) return;
    setMigrating(true);
    setMigrationError("");
    try {
      const result = await migrateStockToLocations({ uid: user!.uid, name: user!.displayName || user!.email || "Super Admin" });
      setMigrationResult(result);
      const status = await getStockLocationMigrationStatus();
      setMigrationStatus(status);
    } catch (err: any) {
      setMigrationError(err.message || "Migration failed.");
    } finally {
      setMigrating(false);
    }
  };

  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canClean) return;
    setSavingShop(true);
    await updateShopSettings(shopForm);
    setSavingShop(false);
    setShopSaved(true);
    setTimeout(() => setShopSaved(false), 2000);
  };

  const handleAddNotifyEmail = () => {
    const email = notifyEmailInput.trim().toLowerCase();
    setNotifyEmailError("");
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNotifyEmailError("Enter a valid email address.");
      return;
    }
    if (notifyEmails.includes(email)) {
      setNotifyEmailError("That email is already in the list.");
      return;
    }
    setNotifyEmails((prev) => [...prev, email]);
    setNotifyEmailInput("");
  };

  const handleRemoveNotifyEmail = (email: string) => {
    setNotifyEmails((prev) => prev.filter((e) => e !== email));
  };

  const handleSaveNotifyEmails = async () => {
    if (!canClean) return;
    setSavingNotifyEmails(true);
    try {
      await updateShopSettings({ notifyEmails });
      setNotifyEmailsSaved(true);
      setTimeout(() => setNotifyEmailsSaved(false), 2000);
    } finally {
      setSavingNotifyEmails(false);
    }
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
    setEditForm({
      displayName: u.displayName,
      role: u.role,
      permissions: isEditableRole(u.role) ? { ...getDefaultPermissions(u.role), ...(u.permissions ?? {}) } : getDefaultPermissions("Admin"),
    });
    setEditMsg(null);
  };

  const handleRoleChange = (role: string) => {
    setEditForm((prev) => ({ ...prev, role, permissions: getDefaultPermissions(role) }));
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);
    setEditMsg(null);
    try {
      const payload: Parameters<typeof updateTeamUser>[1] = { displayName: editForm.displayName, role: editForm.role };
      if (canManagePermissionsFor(userRole ?? "", editForm.role)) payload.permissions = editForm.permissions;
      await updateTeamUser(editingUser.uid, payload);
      setTeamUsers((prev) =>
        prev.map((u) => u.uid === editingUser.uid ? { ...u, ...payload } : u)
      );
      setEditMsg({ type: "success", text: "Updated successfully." });
      setTimeout(() => { setEditingUser(null); setEditMsg(null); }, 1000);
    } catch {
      setEditMsg({ type: "error", text: "Failed to update. Please try again." });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleBackfillPermissions = async () => {
    if (!canClean || backfilling) return;
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const result = await backfillUserPermissions();
      setBackfillResult(result);
      getTeamUsers().then(setTeamUsers);
    } finally {
      setBackfilling(false);
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
        <p className="text-zinc-500 text-sm mt-1">Manage shop info and team — supplier management has moved to its own page</p>
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
                <input className="nexora-input" required disabled={!canClean} placeholder="Shop name" value={shopForm.name} onChange={e => setShopForm({ ...shopForm, name: e.target.value })} />
                <input className="nexora-input" required disabled={!canClean} placeholder="Phone" value={shopForm.phone} onChange={e => setShopForm({ ...shopForm, phone: e.target.value })} />
                <input className="nexora-input" disabled={!canClean} placeholder="Email" value={shopForm.email} onChange={e => setShopForm({ ...shopForm, email: e.target.value })} />
                <input className="nexora-input" disabled={!canClean} placeholder="Address" value={shopForm.address} onChange={e => setShopForm({ ...shopForm, address: e.target.value })} />
              </div>
              {canClean ? (
                <div className="flex items-center gap-3">
                  <button type="submit" disabled={savingShop} className="nexora-btn nexora-btn-primary text-xs py-1.5 px-3">
                    {savingShop ? "Saving..." : "Save Shop Info"}
                  </button>
                  {shopSaved && <span className="text-xs text-green-600">Saved</span>}
                </div>
              ) : (
                <p className="text-xs text-zinc-400">Only Admin and Super Admin can edit shop info.</p>
              )}
            </form>
            <div className="mt-4 pt-4 border-t border-zinc-100">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Logged in as</p>
              <p className="text-sm font-medium text-black">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Right: Low Stock Alerts (Supplier management moved to its own /suppliers page) */}
        <div className="lg:col-span-2">
          {/* Low Stock Alerts — Admin+ only, mirrors Shop Info's edit gating */}
          {canClean && (
            <div className="nexora-card p-4 sm:p-6 mt-6">
              <div className="flex items-center gap-3 mb-4">
                <BellRing size={16} className="text-zinc-400" />
                <h2 className="font-prata text-base text-black">Low Stock Alerts</h2>
              </div>
              <p className="text-xs text-zinc-400 mb-4">
                When a sale takes a product to or below its restock threshold, an email is sent to everyone listed here.
              </p>
              <div className="flex gap-2 mb-2">
                <input
                  type="email"
                  className="nexora-input"
                  placeholder="name@example.com"
                  value={notifyEmailInput}
                  onChange={(e) => { setNotifyEmailInput(e.target.value); setNotifyEmailError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddNotifyEmail(); } }}
                />
                <button type="button" onClick={handleAddNotifyEmail} className="nexora-btn nexora-btn-outline text-xs px-3 shrink-0">
                  <Plus size={12} /> Add
                </button>
              </div>
              {notifyEmailError && <p className="text-xs text-red-600 mb-2">{notifyEmailError}</p>}
              {notifyEmails.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {notifyEmails.map((email) => (
                    <span key={email} className="inline-flex items-center gap-1.5 bg-zinc-100 text-zinc-700 text-xs rounded-full pl-3 pr-2 py-1">
                      {email}
                      <button type="button" onClick={() => handleRemoveNotifyEmail(email)} className="text-zinc-400 hover:text-red-600">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3">
                <button onClick={handleSaveNotifyEmails} disabled={savingNotifyEmails} className="nexora-btn nexora-btn-primary text-xs py-1.5 px-3">
                  {savingNotifyEmails ? "Saving..." : "Save Alert Emails"}
                </button>
                {notifyEmailsSaved && <span className="text-xs text-green-600">Saved</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Team — Admin+ only; team accounts aren't listable by Cashier/Manager under Firestore rules */}
      {canClean && (
      <div className="nexora-card overflow-hidden mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <Users size={16} className="text-zinc-400" />
            <div>
              <h2 className="font-prata text-base text-black">Team</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Users who can log in to Nexora POS</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleBackfillPermissions}
              disabled={backfilling}
              title="Fill in any missing permission entries for Manager/Cashier/Technician accounts"
              className="nexora-btn nexora-btn-outline text-xs py-1.5 px-3 disabled:opacity-60"
            >
              {backfilling ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
              {backfilling ? "Syncing…" : "Sync Permissions"}
            </button>
            <button
              onClick={() => { setShowAddUserModal(true); setUserMsg(null); }}
              className="nexora-btn nexora-btn-primary text-xs py-1.5 px-3"
            >
              <Plus size={12} /> Add User
            </button>
          </div>
        </div>
        {backfillResult && (
          <p className="text-xs text-zinc-500 px-4 sm:px-6 py-2 border-b border-zinc-50">
            {backfillResult.usersTouched === 0
              ? "Every account already has a complete permissions map."
              : `Filled in permissions for ${backfillResult.usersTouched} account${backfillResult.usersTouched === 1 ? "" : "s"}.`}
          </p>
        )}
        <div className="divide-y divide-zinc-50">
          {(() => {
            const visibleTeamUsers = teamUsers.filter((u) => isSuperAdmin || u.role !== "Super Admin");
            if (visibleTeamUsers.length === 0) {
              return (
                <p className="text-center py-8 text-sm text-zinc-400">
                  No users yet — add one to get started
                </p>
              );
            }
            return visibleTeamUsers.map((u) => {
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
                  <button
                    onClick={() => openEditModal(u)}
                    className="p-1.5 rounded hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 transition-colors shrink-0"
                    title="Edit user"
                  >
                    <Pencil size={13} />
                  </button>
                  {!isSelf && (
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
            });
          })()}
        </div>
      </div>
      )}

      {/* Firebase Usage — Admin+ only; the "users" count and CSV export need Admin+ reads */}
      {canClean && (
      <div className="nexora-card p-4 sm:p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Database size={16} className="text-zinc-400" />
            <div>
              <h2 className="font-prata text-base text-black">Firebase Usage</h2>
              <p className="text-xs text-zinc-400 mt-0.5"> live count</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded font-medium">Free</span>
            <button
              onClick={() => { setLoadingUsage(true); getUsageStats().then((s) => { setUsageStats(s); setLoadingUsage(false); }); }}
              disabled={loadingUsage}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-black border border-zinc-200 hover:border-zinc-400 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
            >
              <Loader2 size={11} className={loadingUsage ? "animate-spin" : ""} /> Refresh
            </button>
            {canClean && !loadingUsage && (
              <button
                onClick={() => { setShowCleanModal(true); setCleanTarget(null); setCleanConfirm(""); setCleanResult(null); }}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-2 py-0.5 rounded transition-colors"
              >
                <Trash2 size={11} /> Clean
              </button>
            )}
          </div>
        </div>

        {loadingUsage ? (
          <p className="text-sm text-zinc-400 py-4 text-center">Calculating usage…</p>
        ) : (() => {
          const totalDocs  = usageStats.reduce((s, c) => s + c.count, 0);
          const totalBytes = usageStats.reduce((s, c) => s + c.count * c.avgBytes, 0);
          const STORAGE_LIMIT = 1 * 1024 * 1024 * 1024; // 1 GB

          // Reads: dashboard loads all 3 big collections each open
          const readHeavy = usageStats.find(c => c.key === "sales")?.count ?? 0;
          const readMid   = (usageStats.find(c => c.key === "products")?.count ?? 0)
                          + (usageStats.find(c => c.key === "customers")?.count ?? 0);
          const readsPerLoad = readHeavy + readMid;

          // Writes: 15 writes per sale on average × estimated 30 sales / day
          const estSales = usageStats.find(c => c.key === "sales")?.count ?? 0;
          const avgDailySales = Math.max(1, Math.round(estSales / 30));
          const estDailyWrites = avgDailySales * 15;

          return (
            <>
              <UsageBar
                label="Estimated Storage"
                icon={HardDrive}
                used={totalBytes}
                total={STORAGE_LIMIT}
                usedLabel={formatBytes(totalBytes)}
                totalLabel="1 GB"
              />
              <UsageBar
                label="Reads per Page Load"
                icon={BookOpen}
                used={readsPerLoad}
                total={50_000}
                usedLabel={`~${readsPerLoad.toLocaleString()} reads`}
                totalLabel="50,000 / day"
              />
              <UsageBar
                label="Estimated Daily Writes"
                icon={PenLine}
                used={estDailyWrites}
                total={20_000}
                usedLabel={`~${estDailyWrites.toLocaleString()} writes`}
                totalLabel="20,000 / day"
              />

              {/* Divider */}
              <div className="border-t border-zinc-100 mt-1 mb-4" />

              {/* Collection breakdown */}
              <div className="space-y-2">
                <p className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Collection Breakdown</p>
                {usageStats.filter((c) => c.key !== "users").map((c) => {
                  const bytes = c.count * c.avgBytes;
                  return (
                    <div key={c.key} className="flex items-center gap-2 sm:gap-3">
                      <span className="text-xs text-zinc-500 w-24 sm:w-36 shrink-0 truncate">{c.label}</span>
                      <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-zinc-400 rounded-full"
                          style={{ width: `${totalBytes > 0 ? Math.max((bytes / totalBytes) * 100, c.count > 0 ? 2 : 0) : 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-400 w-14 sm:w-16 text-right shrink-0">
                        {c.count.toLocaleString()} docs
                      </span>
                      <span className="hidden sm:inline-block text-xs text-zinc-300 w-16 text-right shrink-0">
                        {formatBytes(bytes)}
                      </span>
                      <span className="hidden sm:inline-block text-xs text-zinc-300 w-10 text-right shrink-0">
                        {totalBytes > 0 ? ((bytes / totalBytes) * 100).toFixed(1) : "0.0"}%
                      </span>
                      {canClean && (
                        <button
                          onClick={() => handleExportCSV(c)}
                          disabled={c.count === 0 || exportingKey === c.key}
                          title={`Download ${c.label} as CSV`}
                          className="p-1 rounded text-zinc-400 hover:text-black hover:bg-zinc-100 transition-colors shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          {exportingKey === c.key ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Download size={13} />
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Totals */}
              <div className="mt-4 pt-4 border-t border-zinc-100 flex flex-wrap gap-x-6 gap-y-1">
                <p className="text-xs text-zinc-500">
                  Total documents: <span className="font-medium text-black">{totalDocs.toLocaleString()}</span>
                </p>
                <p className="text-xs text-zinc-500">
                  Estimated size: <span className="font-medium text-black">{formatBytes(totalBytes)}</span>
                </p>
                <p className="text-xs text-zinc-500">
                  Free limit: <span className="font-medium text-black">1 GB storage · 50K reads/day · 20K writes/day</span>
                </p>
              </div>
            </>
          );
        })()}
      </div>
      )}

      {/* Stock Location Migration — Super Admin only, one-time, resumable */}
      {isSuperAdmin && (
      <div className="nexora-card p-4 sm:p-6 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <Boxes size={16} className="text-zinc-400" />
          <div>
            <h2 className="font-prata text-base text-black">Stock Location Migration</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Splits stock into Stores Stock and Showroom Stock</p>
          </div>
        </div>

        {loadingMigrationStatus ? (
          <p className="text-sm text-zinc-400 py-2">Checking status…</p>
        ) : migrationStatus?.done ? (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <CheckCircle size={14} /> Already migrated{migrationStatus.migratedByName ? ` by ${migrationStatus.migratedByName}` : ""}.
          </p>
        ) : (
          <>
            <p className="text-xs text-zinc-500 mb-3">
              One-time step: tags every existing batch/unit as Stores Stock and adds the Stores/Showroom split to every product.
              Nothing is sellable via POS until it's transferred to Showroom afterward. Safe to re-run if interrupted.
            </p>
            <button
              onClick={handleMigrateStock}
              disabled={migrating}
              className="nexora-btn nexora-btn-primary text-xs disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {migrating ? <Loader2 size={12} className="animate-spin" /> : <Boxes size={12} />}
              {migrating ? "Migrating…" : "Migrate Stock to Stores/Showroom"}
            </button>
            {migrationError && <p className="text-xs text-red-500 mt-2">{migrationError}</p>}
            {migrationResult && (
              <p className="text-xs text-zinc-500 mt-2">
                Done — {migrationResult.productsTouched} products, {migrationResult.batchesTouched} batches, {migrationResult.unitsTouched} units updated.
              </p>
            )}
          </>
        )}
      </div>
      )}

      {/* Firebase collections reference */}
      <div className="nexora-card p-4 sm:p-6" style={{ display: "none" }}>
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

      {/* Edit User modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
              <h2 className="font-prata text-lg">Edit User</h2>
              <button onClick={() => setEditingUser(null)}><X size={16} className="text-zinc-400" /></button>
            </div>
            <form onSubmit={handleEditUser} className="px-6 py-4 space-y-3 overflow-y-auto flex-1 min-h-0">
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
                  onChange={e => handleRoleChange(e.target.value)}
                >
                  {isSuperAdmin && <option value="Super Admin">Super Admin</option>}
                  <option value="Admin">Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="Cashier">Cashier</option>
                  <option value="Technician">Technician</option>
                </select>
              </div>
              {canManagePermissionsFor(userRole ?? "", editForm.role) && (
                <div className="border border-zinc-100 rounded-lg p-3">
                  <p className="text-xs text-zinc-500 mb-2">
                    Permissions for this {editForm.role} — untick anything they shouldn't be able to do.
                  </p>
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {PERMISSION_MODULES.map(({ module, keys }) => (
                      <div key={module}>
                        <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1">{module}</p>
                        <div className="space-y-1">
                          {keys.map((key) => {
                            const def = PERMISSION_CATALOG.find((p) => p.key === key)!;
                            return (
                              <label key={key} className="flex items-center gap-2 text-sm text-black cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!editForm.permissions[key]}
                                  onChange={(e) =>
                                    setEditForm((prev) => ({
                                      ...prev,
                                      permissions: { ...prev.permissions, [key]: e.target.checked },
                                    }))
                                  }
                                />
                                {def.label}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                  {isSuperAdmin && <option value="Super Admin">Super Admin</option>}
                  <option value="Admin">Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="Cashier">Cashier</option>
                  <option value="Technician">Technician</option>
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

      {/* Clean Collection modal */}
      {showCleanModal && (() => {
        const PROTECTED = new Set(["users", "counters", "shopSettings"]);
        const cleanable = usageStats.filter(c => !PROTECTED.has(c.key));
        const confirmed = cleanTarget && cleanConfirm === cleanTarget.key;

        const handleClean = async () => {
          if (!cleanTarget || !confirmed) return;
          setCleaning(true);
          try {
            const deleted = await cleanCollection(cleanTarget.key);
            setCleanResult({ count: deleted });
            setCleanConfirm("");
            getUsageStats().then(s => { setUsageStats(s); setLoadingUsage(false); });
          } finally {
            setCleaning(false);
          }
        };

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl w-full max-w-md mx-4">
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <Trash2 size={15} className="text-red-500" />
                  <h2 className="font-prata text-base">Clean Collection</h2>
                </div>
                <button onClick={() => setShowCleanModal(false)} disabled={cleaning}>
                  <X size={16} className="text-zinc-400" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4">
                {cleanResult ? (
                  <div className="text-center py-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <CheckCircle size={22} className="text-green-600" />
                    </div>
                    <p className="text-sm font-medium text-black">Done</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      Deleted <span className="font-medium text-black">{cleanResult.count}</span> documents from <code className="bg-zinc-100 px-1 rounded">{cleanTarget?.key}</code>
                    </p>
                    <button
                      onClick={() => setShowCleanModal(false)}
                      className="nexora-btn nexora-btn-primary mt-4 justify-center"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                      <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700">
                        This permanently deletes <span className="font-semibold">all documents</span> in the selected collection. This action cannot be undone.
                      </p>
                    </div>

                    <div>
                      <label className="text-xs text-zinc-500 mb-1.5 block">Select collection to clean</label>
                      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                        {cleanable.map(c => (
                          <button
                            key={c.key}
                            onClick={() => { setCleanTarget(c); setCleanConfirm(""); setCleanResult(null); }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded border text-left transition-colors ${
                              cleanTarget?.key === c.key
                                ? "border-red-400 bg-red-50"
                                : "border-zinc-200 hover:border-zinc-400"
                            }`}
                          >
                            <span className="text-sm font-medium text-black">{c.label}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              c.count === 0
                                ? "bg-zinc-100 text-zinc-400"
                                : "bg-red-100 text-red-600 font-medium"
                            }`}>
                              {c.count} docs
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {cleanTarget && (
                      <div>
                        <label className="text-xs text-zinc-500 mb-1.5 block">
                          Type <code className="bg-zinc-100 px-1 rounded text-black">{cleanTarget.key}</code> to confirm
                        </label>
                        <input
                          className="nexora-input"
                          placeholder={cleanTarget.key}
                          value={cleanConfirm}
                          onChange={e => setCleanConfirm(e.target.value)}
                          autoFocus
                        />
                      </div>
                    )}

                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={() => setShowCleanModal(false)}
                        className="nexora-btn nexora-btn-outline flex-1 justify-center"
                        disabled={cleaning}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleClean}
                        disabled={!confirmed || cleaning || cleanTarget?.count === 0}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <Trash2 size={13} />
                        {cleaning ? "Deleting…" : `Delete ${cleanTarget ? `${cleanTarget.count} docs` : "All"}`}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
