"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getSuppliers, addSupplier, updateSupplier,
  createSupplierPayment, getSupplierPayments, markSupplierStatementSent, adminUpdateSupplierPayment,
} from "@/lib/firestore";
import { useAuth } from "@/hooks/useAuth";
import type { Supplier, SupplierPaymentMethod } from "@/types";
import { Search, Plus, Eye, X, Truck, Pencil, Mail, Wallet, FileDown, Bell, ChevronDown, ChevronUp } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { rowsToCSV, downloadCSV } from "@/lib/csv";
import AccessRestricted from "@/components/ui/AccessRestricted";

const PAGE_SIZE = 10;

const STATUS_BADGE: Record<string, string> = {
  paid: "badge-success",
  partial: "badge-warning",
  outstanding: "badge-danger",
};

const STATUS_LABEL: Record<string, string> = {
  paid: "Paid",
  partial: "Partial",
  outstanding: "Outstanding",
};

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  cheque: "Cheque",
  other: "Other",
};

function emptyContactForm() {
  return { name: "", phone: "", email: "", address: "" };
}

export default function SuppliersPage() {
  const { user, userDisplayName, can } = useAuth();
  const canView = can("suppliers.view");
  const canEditContact = can("suppliers.editContact");
  const canRecordPayment = can("suppliers.recordPayment");
  const canSendStatement = can("suppliers.sendStatement");
  const canEditPayment = can("suppliers.editPayment");

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState(emptyContactForm());
  const [savingAdd, setSavingAdd] = useState(false);

  const [editingContact, setEditingContact] = useState<Supplier | null>(null);
  const [contactForm, setContactForm] = useState(emptyContactForm());
  const [savingContact, setSavingContact] = useState(false);

  const [viewSupplier, setViewSupplier] = useState<Supplier | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const [recordingPayment, setRecordingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "cash" as SupplierPaymentMethod, reference: "", note: "" });
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  const [sendingStatement, setSendingStatement] = useState(false);
  const [statementNotice, setStatementNotice] = useState("");

  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editPaymentForm, setEditPaymentForm] = useState({ amount: "", method: "cash" as SupplierPaymentMethod, reference: "", note: "" });
  const [savingPaymentEdit, setSavingPaymentEdit] = useState(false);

  const [remindersOpen, setRemindersOpen] = useState(true);

  const loadSuppliers = () => getSuppliers().then((s) => { setSuppliers(s as Supplier[]); setLoading(false); });

  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const openSupplier = async (s: Supplier) => {
    setViewSupplier(s);
    setRecordingPayment(false);
    setPaymentError("");
    setStatementNotice("");
    setLoadingPayments(true);
    const p = await getSupplierPayments({ supplierId: s.id });
    setPayments(p);
    setLoadingPayments(false);
  };

  const refreshViewSupplier = async () => {
    const all = await getSuppliers();
    setSuppliers(all as Supplier[]);
    const refreshed = (all as Supplier[]).find((s) => s.id === viewSupplier?.id) || null;
    setViewSupplier(refreshed);
    if (refreshed) {
      const p = await getSupplierPayments({ supplierId: refreshed.id });
      setPayments(p);
    }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAdd(true);
    try {
      await addSupplier(addForm);
      setShowAddModal(false);
      setAddForm(emptyContactForm());
      loadSuppliers();
    } finally {
      setSavingAdd(false);
    }
  };

  const openEditContact = (s: Supplier) => {
    setEditingContact(s);
    setContactForm({ name: s.name || "", phone: s.phone || "", email: s.email || "", address: s.address || "" });
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact) return;
    setSavingContact(true);
    try {
      await updateSupplier(editingContact.id, contactForm);
      await loadSuppliers();
      setEditingContact(null);
      if (viewSupplier?.id === editingContact.id) {
        setViewSupplier((v) => (v ? { ...v, ...contactForm } : v));
      }
    } finally {
      setSavingContact(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!viewSupplier) return;
    setPaymentError("");
    const amount = Number(paymentForm.amount);
    if (!amount || amount <= 0) { setPaymentError("Enter a valid amount."); return; }
    setSavingPayment(true);
    try {
      await createSupplierPayment({
        supplierId: viewSupplier.id,
        amount,
        method: paymentForm.method,
        reference: paymentForm.reference,
        note: paymentForm.note,
        paidById: user!.uid,
        paidByName: userDisplayName || user?.email || "Admin",
      });
      setRecordingPayment(false);
      setPaymentForm({ amount: "", method: "cash", reference: "", note: "" });
      await refreshViewSupplier();
    } catch (err: any) {
      setPaymentError(err.message || "Failed to record payment.");
    } finally {
      setSavingPayment(false);
    }
  };

  const handleSendStatement = async () => {
    if (!viewSupplier?.email) return;
    setSendingStatement(true);
    setStatementNotice("");
    try {
      const idToken = await user!.getIdToken();
      const res = await fetch("/api/suppliers/send-account-statement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          supplierId: viewSupplier.id,
          supplierName: viewSupplier.name,
          supplierEmail: viewSupplier.email,
          totalPayable: viewSupplier.totalPayable,
          amountPaid: viewSupplier.amountPaid,
          balance: viewSupplier.balance,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send statement");
      await markSupplierStatementSent(viewSupplier.id);
      setStatementNotice(`Statement emailed to ${viewSupplier.email}.`);
      await refreshViewSupplier();
    } catch (err: any) {
      setStatementNotice(err.message || "Failed to send statement.");
    } finally {
      setSendingStatement(false);
    }
  };

  const openEditPayment = (p: any) => {
    setEditingPaymentId(p.id);
    setEditPaymentForm({ amount: String(p.amount), method: p.method, reference: p.reference || "", note: p.note || "" });
  };

  const handleSavePaymentEdit = async () => {
    if (!editingPaymentId) return;
    setSavingPaymentEdit(true);
    try {
      await adminUpdateSupplierPayment(
        editingPaymentId,
        {
          amount: Number(editPaymentForm.amount),
          method: editPaymentForm.method,
          reference: editPaymentForm.reference,
          note: editPaymentForm.note,
        },
        { uid: user!.uid, name: userDisplayName || user?.email || "Admin" }
      );
      setEditingPaymentId(null);
      await refreshViewSupplier();
    } finally {
      setSavingPaymentEdit(false);
    }
  };

  const filtered = suppliers.filter((s) =>
    s.name?.toLowerCase().includes(search.toLowerCase()) || s.phone?.includes(search)
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const formatDate = (ts: any) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const handleExportCSV = () => {
    const rows = filtered.map((s) => ({
      Name: s.name,
      Phone: s.phone,
      Email: s.email || "",
      "Total Payable": s.totalPayable,
      "Amount Paid": s.amountPaid,
      Balance: s.balance,
      Status: STATUS_LABEL[s.paymentStatus] || s.paymentStatus,
    }));
    downloadCSV(`suppliers-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCSV(rows));
  };

  // Payment reminders — suppliers we still owe money to, ranked by how long
  // it's been since we last paid them (or since the account was opened, if
  // never paid) so the oldest unpaid balance surfaces first.
  const paymentReminders = suppliers
    .filter((s) => (s.balance ?? 0) > 0)
    .map((s) => {
      const anchor = s.lastPaymentAt || s.createdAt;
      const anchorDate = anchor?.toDate ? anchor.toDate() : anchor ? new Date(anchor) : null;
      const daysSince = anchorDate ? Math.floor((Date.now() - anchorDate.getTime()) / 86400000) : null;
      return { ...s, daysSince };
    })
    .sort((a, b) => (b.daysSince ?? 0) - (a.daysSince ?? 0));
  const totalReminderBalance = paymentReminders.reduce((s, x) => s + (x.balance || 0), 0);

  if (!canView) return <AccessRestricted message="You don't have permission to view Suppliers." />;

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-prata text-2xl text-black">Suppliers</h1>
          <p className="text-zinc-500 text-sm mt-1">{suppliers.length} suppliers</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link href="/suppliers/payments" className="nexora-btn nexora-btn-outline">
            <FileDown size={14} /> Payment Report
          </Link>
          <button onClick={handleExportCSV} disabled={filtered.length === 0} className="nexora-btn nexora-btn-outline disabled:opacity-50 disabled:cursor-not-allowed">
            Download CSV
          </button>
          <button onClick={() => setShowAddModal(true)} className="nexora-btn nexora-btn-primary">
            <Plus size={14} /> Add Supplier
          </button>
        </div>
      </div>

      {/* Payment reminders — outstanding balances we owe suppliers */}
      {paymentReminders.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setRemindersOpen((v) => !v)}
            className="w-full flex items-start sm:items-center gap-2.5 sm:gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3 sm:px-4 py-3 text-left"
          >
            <Bell size={15} className="text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            <p className="text-sm text-amber-700 flex-1">
              <span className="font-medium">{paymentReminders.length} supplier{paymentReminders.length > 1 ? "s" : ""}</span> with an outstanding balance — Rs. {totalReminderBalance.toLocaleString()} total.
            </p>
            {remindersOpen ? <ChevronUp size={14} className="text-amber-600 shrink-0" /> : <ChevronDown size={14} className="text-amber-600 shrink-0" />}
          </button>
          {remindersOpen && (
            <div className="nexora-card overflow-x-auto mt-2">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium uppercase tracking-wider">Supplier</th>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium uppercase tracking-wider">Balance</th>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium uppercase tracking-wider">Last Payment</th>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium uppercase tracking-wider">Unpaid For</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {paymentReminders.map((s) => (
                    <tr key={s.id} onClick={() => openSupplier(s)} className="hover:bg-zinc-50 transition-colors cursor-pointer">
                      <td className="px-4 py-2.5 font-medium text-black">{s.name}</td>
                      <td className="px-4 py-2.5">Rs. {s.balance?.toLocaleString() ?? 0}</td>
                      <td className="px-4 py-2.5 text-zinc-500 text-xs">{s.lastPaymentAt ? formatDate(s.lastPaymentAt) : "Never paid"}</td>
                      <td className="px-4 py-2.5 text-zinc-500 text-xs">{s.daysSince != null ? `${s.daysSince} day${s.daysSince === 1 ? "" : "s"}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="relative flex-1 min-w-[200px] sm:max-w-sm mb-6">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input className="nexora-input pl-9" placeholder="Search by name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="nexora-card overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Phone</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Total Payable</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Amount Paid</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Balance</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-zinc-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-zinc-400">No suppliers found</td></tr>
            ) : (
              paginated.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-black">{s.name}</td>
                  <td className="px-4 py-3 text-zinc-600">{s.phone}</td>
                  <td className="px-4 py-3">Rs. {s.totalPayable?.toLocaleString() ?? 0}</td>
                  <td className="px-4 py-3">Rs. {s.amountPaid?.toLocaleString() ?? 0}</td>
                  <td className="px-4 py-3 font-medium">Rs. {s.balance?.toLocaleString() ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_BADGE[s.paymentStatus] || "badge-default"}`}>{STATUS_LABEL[s.paymentStatus] || s.paymentStatus}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openSupplier(s)} className="nexora-btn nexora-btn-ghost py-1 px-2 text-xs">
                      <Eye size={12} /> View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {/* Add Supplier modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h2 className="font-prata text-lg">Add Supplier</h2>
              <button onClick={() => setShowAddModal(false)}><X size={16} className="text-zinc-400" /></button>
            </div>
            <form onSubmit={handleAddSupplier} className="px-6 py-4 space-y-3">
              <input className="nexora-input" required placeholder="Supplier name" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
              <input className="nexora-input" required placeholder="Phone" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} />
              <input className="nexora-input" placeholder="Email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} />
              <input className="nexora-input" placeholder="Address" value={addForm.address} onChange={(e) => setAddForm({ ...addForm, address: e.target.value })} />
              <button type="submit" disabled={savingAdd} className="nexora-btn nexora-btn-primary w-full justify-center disabled:opacity-60">
                {savingAdd ? "Saving…" : "Add Supplier"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit contact modal */}
      {editingContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h2 className="font-prata text-lg">Edit Supplier</h2>
              <button onClick={() => setEditingContact(null)}><X size={16} className="text-zinc-400" /></button>
            </div>
            <form onSubmit={handleSaveContact} className="px-6 py-4 space-y-3">
              <input className="nexora-input" required placeholder="Supplier name" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} />
              <input className="nexora-input" required placeholder="Phone" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} />
              <input className="nexora-input" placeholder="Email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
              <input className="nexora-input" placeholder="Address" value={contactForm.address} onChange={(e) => setContactForm({ ...contactForm, address: e.target.value })} />
              <button type="submit" disabled={savingContact} className="nexora-btn nexora-btn-primary w-full justify-center disabled:opacity-60">
                {savingContact ? "Saving…" : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Supplier detail modal */}
      {viewSupplier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-zinc-100 sticky top-0 bg-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck size={16} className="text-zinc-400" />
                <h2 className="font-prata text-lg">{viewSupplier.name}</h2>
              </div>
              <button onClick={() => setViewSupplier(null)} className="text-zinc-400 hover:text-black"><X size={18} /></button>
            </div>

            <div className="px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
                <div>
                  <p className="text-sm text-zinc-600">{viewSupplier.phone} {viewSupplier.email ? `· ${viewSupplier.email}` : ""}</p>
                  {viewSupplier.address && <p className="text-xs text-zinc-400 mt-0.5">{viewSupplier.address}</p>}
                </div>
                {canEditContact && (
                  <button onClick={() => openEditContact(viewSupplier)} className="nexora-btn nexora-btn-ghost text-xs py-1.5 px-2.5">
                    <Pencil size={12} /> Edit Contact
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
                <div className="nexora-card p-3">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Total Payable</p>
                  <p className="text-sm font-medium">Rs. {viewSupplier.totalPayable?.toLocaleString() ?? 0}</p>
                </div>
                <div className="nexora-card p-3">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Amount Paid</p>
                  <p className="text-sm font-medium">Rs. {viewSupplier.amountPaid?.toLocaleString() ?? 0}</p>
                </div>
                <div className="nexora-card p-3">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Balance</p>
                  <p className="text-sm font-medium">Rs. {viewSupplier.balance?.toLocaleString() ?? 0}</p>
                </div>
                <div className="nexora-card p-3">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Status</p>
                  <span className={`badge ${STATUS_BADGE[viewSupplier.paymentStatus] || "badge-default"}`}>{STATUS_LABEL[viewSupplier.paymentStatus] || viewSupplier.paymentStatus}</span>
                </div>
              </div>

              {(canRecordPayment || canSendStatement) && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {canRecordPayment && (
                    <button onClick={() => setRecordingPayment((v) => !v)} className="nexora-btn nexora-btn-outline text-sm">
                      <Wallet size={14} /> Record Payment
                    </button>
                  )}
                  {canSendStatement && (
                    <button
                      onClick={handleSendStatement}
                      disabled={sendingStatement || (viewSupplier.balance ?? 0) <= 0 || !viewSupplier.email}
                      title={!viewSupplier.email ? "No email on file" : (viewSupplier.balance ?? 0) <= 0 ? "Nothing outstanding" : ""}
                      className="nexora-btn nexora-btn-outline text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Mail size={14} /> {sendingStatement ? "Sending…" : "Send Statement"}
                    </button>
                  )}
                </div>
              )}

              {statementNotice && (
                <div className="mb-4 px-4 py-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-sm text-zinc-600 flex items-center justify-between">
                  <span>{statementNotice}</span>
                  <button onClick={() => setStatementNotice("")} className="text-zinc-400 hover:text-black"><X size={14} /></button>
                </div>
              )}

              {recordingPayment && (
                <div className="nexora-card p-4 mb-6 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Amount (Rs.)</label>
                      <input type="number" className="nexora-input" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Method</label>
                      <select className="nexora-input" value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value as SupplierPaymentMethod })}>
                        <option value="cash">Cash</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="cheque">Cheque</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Reference (optional)</label>
                      <input className="nexora-input" value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Note (optional)</label>
                      <input className="nexora-input" value={paymentForm.note} onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })} />
                    </div>
                  </div>
                  {paymentError && <p className="text-xs text-red-500">{paymentError}</p>}
                  <button onClick={handleRecordPayment} disabled={savingPayment} className="nexora-btn nexora-btn-primary text-sm disabled:opacity-60">
                    {savingPayment ? "Saving…" : "Save Payment"}
                  </button>
                </div>
              )}

              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Payment History</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      <th className="text-left py-2 text-xs text-zinc-500 font-medium">Payment No.</th>
                      <th className="text-left py-2 text-xs text-zinc-500 font-medium">Date</th>
                      <th className="text-right py-2 text-xs text-zinc-500 font-medium">Amount</th>
                      <th className="text-left py-2 text-xs text-zinc-500 font-medium">Method</th>
                      <th className="text-right py-2 text-xs text-zinc-500 font-medium">Balance After</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {loadingPayments ? (
                      <tr><td colSpan={6} className="text-center py-6 text-zinc-400">Loading…</td></tr>
                    ) : payments.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-6 text-zinc-400">No payments recorded</td></tr>
                    ) : (
                      payments.map((p) =>
                        editingPaymentId === p.id ? (
                          <tr key={p.id}>
                            <td colSpan={6} className="py-3">
                              <div className="nexora-card p-3 space-y-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <input type="number" className="nexora-input" value={editPaymentForm.amount} onChange={(e) => setEditPaymentForm({ ...editPaymentForm, amount: e.target.value })} placeholder="Amount" />
                                  <select className="nexora-input" value={editPaymentForm.method} onChange={(e) => setEditPaymentForm({ ...editPaymentForm, method: e.target.value as SupplierPaymentMethod })}>
                                    <option value="cash">Cash</option>
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="cheque">Cheque</option>
                                    <option value="other">Other</option>
                                  </select>
                                  <input className="nexora-input" value={editPaymentForm.reference} onChange={(e) => setEditPaymentForm({ ...editPaymentForm, reference: e.target.value })} placeholder="Reference" />
                                  <input className="nexora-input" value={editPaymentForm.note} onChange={(e) => setEditPaymentForm({ ...editPaymentForm, note: e.target.value })} placeholder="Note" />
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={handleSavePaymentEdit} disabled={savingPaymentEdit} className="nexora-btn nexora-btn-primary text-xs py-1.5 disabled:opacity-60">
                                    {savingPaymentEdit ? "Saving…" : "Save"}
                                  </button>
                                  <button onClick={() => setEditingPaymentId(null)} className="nexora-btn nexora-btn-outline text-xs py-1.5">Cancel</button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr key={p.id}>
                            <td className="py-2.5 font-medium text-black">{p.paymentNo}</td>
                            <td className="py-2.5 text-zinc-500 text-xs">{formatDate(p.createdAt)}</td>
                            <td className="py-2.5 text-right">Rs. {p.amount?.toLocaleString()}</td>
                            <td className="py-2.5">{METHOD_LABEL[p.method] || p.method}</td>
                            <td className="py-2.5 text-right">Rs. {p.balanceAfter?.toLocaleString()}</td>
                            <td className="py-2.5 text-right">
                              {canEditPayment && (
                                <button onClick={() => openEditPayment(p)} className="text-zinc-400 hover:text-black"><Pencil size={13} /></button>
                              )}
                            </td>
                          </tr>
                        )
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
