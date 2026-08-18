"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getPayableUsers, setSalarySetup, clearSalarySetup, issueSalaryPayment, getSalaryPayments, deleteSalaryPayment,
  getSales, getJobs, getShifts,
} from "@/lib/firestore";
import { SalaryType, SalarySetup, SalaryPayment, SalaryCommissionItem, UserProfile } from "@/types";
import { Banknote, Download, Mail, Trash2, X, Check, Eye, Search } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { rowsToCSV, downloadCSV } from "@/lib/csv";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

const PAGE_SIZE = 20;

const TYPE_LABEL: Record<SalaryType, string> = {
  monthly: "Monthly",
  commission: "Commission",
  hybrid: "Hybrid",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartStr() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function currentMonthLabel() {
  return new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

const formatDate = (ts: any) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

// How long a shift has been sitting open — flags a stale/abandoned till in
// the "which shift?" picker so it isn't mistaken for the current live one.
const daysOpen = (openedAt: any) => {
  if (!openedAt) return 0;
  const opened = openedAt.toDate ? openedAt.toDate() : new Date(openedAt);
  return Math.floor((Date.now() - opened.getTime()) / (24 * 60 * 60 * 1000));
};

export default function SalaryPage() {
  const { user, userDisplayName, can } = useAuth();
  const canView = can("salary.view");
  const canIssue = can("salary.issue");
  const canDelete = can("salary.delete");
  const canManageConfig = can("salary.manageConfig");

  const [tab, setTab] = useState<"issue" | "history" | "setup">("issue");
  const [payableUsers, setPayableUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  useEffect(() => {
    if (!canView) { setUsersLoading(false); return; }
    setUsersLoading(true);
    getPayableUsers().then((u) => {
      setPayableUsers(u);
      setUsersLoading(false);
    });
  }, [canView]);

  // ─── Issue Salary ───────────────────────────────────────────────────────
  const [issueUserId, setIssueUserId] = useState("");
  const [issueType, setIssueType] = useState<SalaryType>("monthly");
  const [issueMonthlyAmount, setIssueMonthlyAmount] = useState("");
  const [issueCommissionBase, setIssueCommissionBase] = useState("");
  const [issueCommissionPercent, setIssueCommissionPercent] = useState("");
  const [issueAmount, setIssueAmount] = useState("");
  const [issuePeriodLabel, setIssuePeriodLabel] = useState(currentMonthLabel());
  const [issueNote, setIssueNote] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState("");
  const [issueSuccess, setIssueSuccess] = useState<string | null>(null);

  // Paying a salary/advance out of a cashier's till debits that shift's cash
  // drawer (via issueSalaryPayment's shiftId link), same mechanism as
  // Finance > Expenses' "paid from till" option — otherwise the payout is
  // invisible to closeShift()'s expected-cash math and reads as a shortage.
  const [paidFromDrawer, setPaidFromDrawer] = useState(false);
  const [issueShiftId, setIssueShiftId] = useState("");
  const [openShiftsForSalary, setOpenShiftsForSalary] = useState<any[]>([]);
  const [loadingOpenShifts, setLoadingOpenShifts] = useState(false);

  useEffect(() => {
    if (!paidFromDrawer) return;
    setLoadingOpenShifts(true);
    getShifts({ status: "open" }).then((s) => {
      setOpenShiftsForSalary(s);
      setLoadingOpenShifts(false);
    });
  }, [paidFromDrawer]);

  const selectedDrawerShift = useMemo(
    () => openShiftsForSalary.find((s) => s.id === issueShiftId) || null,
    [openShiftsForSalary, issueShiftId]
  );

  // Sale/Job picker for commission payments — lets the admin search by
  // invoice/job number and attach specific sales/jobs as the audit trail
  // for a commission, instead of only typing in a lump commissionBase.
  const [commissionItems, setCommissionItems] = useState<SalaryCommissionItem[]>([]);
  const [commissionSearch, setCommissionSearch] = useState("");
  const [commissionPool, setCommissionPool] = useState<{ sales: any[]; jobs: any[] } | null>(null);
  const [commissionPoolLoading, setCommissionPoolLoading] = useState(false);

  useEffect(() => {
    const showsPicker = issueType === "commission" || issueType === "hybrid";
    if (!showsPicker || commissionPool || commissionPoolLoading) return;
    setCommissionPoolLoading(true);
    Promise.all([
      getSales({ fromDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) }),
      getJobs(),
    ]).then(([sales, jobs]) => {
      setCommissionPool({ sales, jobs });
      setCommissionPoolLoading(false);
    });
  }, [issueType, commissionPool, commissionPoolLoading]);

  const commissionSearchResults = useMemo(() => {
    const term = commissionSearch.trim().toLowerCase();
    if (!commissionPool || term.length < 2) return { sales: [] as any[], jobs: [] as any[] };
    const selectedKeys = new Set(commissionItems.map((i) => `${i.kind}:${i.id}`));
    const sales = commissionPool.sales
      .filter(
        (s: any) =>
          !s.commissionPaymentId &&
          s.status !== "cancelled" &&
          !selectedKeys.has(`sale:${s.id}`) &&
          (s.invoiceNo?.toLowerCase().includes(term) || s.customerName?.toLowerCase().includes(term))
      )
      .slice(0, 8);
    const jobs = commissionPool.jobs
      .filter(
        (j: any) =>
          !j.commissionPaymentId &&
          !selectedKeys.has(`job:${j.id}`) &&
          (j.jobNo?.toLowerCase().includes(term) || j.customerName?.toLowerCase().includes(term))
      )
      .slice(0, 8);
    return { sales, jobs };
  }, [commissionPool, commissionSearch, commissionItems]);

  const commissionItemsTotal = commissionItems.reduce((s, i) => s + i.amount, 0);

  // Commission Base tracks the linked sales/jobs automatically — the admin
  // picks items first, then just types the %, and the payable amount
  // recalculates live (see suggestedAmount below).
  useEffect(() => {
    setIssueCommissionBase(commissionItems.length > 0 ? String(commissionItemsTotal) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commissionItems]);

  const addCommissionItem = (kind: "sale" | "job", record: any) => {
    const amount = kind === "sale" ? record.totalAmount || 0 : (record.repairCost ?? record.estimatedCost ?? 0);
    const number = kind === "sale" ? record.invoiceNo : record.jobNo;
    setCommissionItems((prev) => [...prev, { kind, id: record.id, number, amount }]);
    setCommissionSearch("");
  };

  const removeCommissionItem = (kind: "sale" | "job", id: string) => {
    setCommissionItems((prev) => prev.filter((i) => !(i.kind === kind && i.id === id)));
  };

  const selectedUser = payableUsers.find((u) => u.uid === issueUserId) || null;
  const commissionAmount = ((Number(issueCommissionBase) || 0) * (Number(issueCommissionPercent) || 0)) / 100;
  const suggestedAmount =
    issueType === "monthly"
      ? Number(issueMonthlyAmount) || 0
      : issueType === "commission"
      ? commissionAmount
      : (Number(issueMonthlyAmount) || 0) + commissionAmount;

  // Re-suggest the final amount whenever the inputs it's derived from change —
  // the admin can still hand-edit the Amount field afterward before submitting,
  // matching the "10% it's dynamic" ask (the % is never locked to a fixed payout).
  useEffect(() => {
    setIssueAmount(suggestedAmount > 0 ? String(suggestedAmount) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueType, issueMonthlyAmount, issueCommissionBase, issueCommissionPercent]);

  const handleSelectIssueUser = (uid: string) => {
    setIssueUserId(uid);
    setIssueSuccess(null);
    setIssueError("");
    const u = payableUsers.find((p) => p.uid === uid);
    const setup = u?.salarySetup;
    setIssueType(setup?.type || "monthly");
    setIssueMonthlyAmount(setup?.monthlyAmount != null ? String(setup.monthlyAmount) : "");
    setIssueCommissionPercent(setup?.commissionPercent != null ? String(setup.commissionPercent) : "");
    setIssueCommissionBase("");
  };

  const resetIssueForm = () => {
    setIssueUserId("");
    setIssueType("monthly");
    setIssueMonthlyAmount("");
    setIssueCommissionBase("");
    setIssueCommissionPercent("");
    setIssueAmount("");
    setIssuePeriodLabel(currentMonthLabel());
    setIssueNote("");
    setCommissionItems([]);
    setCommissionSearch("");
    setPaidFromDrawer(false);
    setIssueShiftId("");
  };

  const handleIssue = async () => {
    if (!user || !selectedUser) {
      setIssueError("Select an employee");
      return;
    }
    const amount = Number(issueAmount);
    if (!issueAmount || amount <= 0) {
      setIssueError("Enter a valid amount");
      return;
    }
    if (paidFromDrawer && !issueShiftId) {
      setIssueError("Pick which cashier's till this was paid from");
      return;
    }
    setIssuing(true);
    setIssueError("");
    try {
      const { paymentNo } = await issueSalaryPayment({
        userId: selectedUser.uid,
        userName: selectedUser.displayName,
        userRole: selectedUser.role,
        type: issueType,
        amount,
        commissionBase: issueType !== "monthly" && issueCommissionBase ? Number(issueCommissionBase) : undefined,
        commissionPercent: issueType !== "monthly" && issueCommissionPercent ? Number(issueCommissionPercent) : undefined,
        commissionItems: issueType !== "monthly" && commissionItems.length > 0 ? commissionItems : undefined,
        periodLabel: issuePeriodLabel || currentMonthLabel(),
        note: issueNote || undefined,
        issuedById: user.uid,
        issuedByName: userDisplayName || "Admin",
        ...(paidFromDrawer && selectedDrawerShift
          ? { shiftId: selectedDrawerShift.id, shiftNo: selectedDrawerShift.shiftNo }
          : {}),
      });
      setIssueSuccess(paymentNo);
      resetIssueForm();
      setCommissionPool(null);
      reloadPayments();
    } catch (err: any) {
      setIssueError(err?.message || "Failed to issue salary payment");
    }
    setIssuing(false);
  };

  // ─── Payment History ────────────────────────────────────────────────────
  const [histFromDate, setHistFromDate] = useState(monthStartStr());
  const [histToDate, setHistToDate] = useState(todayStr());
  const [histUserFilter, setHistUserFilter] = useState("");
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [histLoading, setHistLoading] = useState(true);
  const [histPage, setHistPage] = useState(1);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const [deletingPayment, setDeletingPayment] = useState(false);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [emailNotice, setEmailNotice] = useState("");
  const [viewPayment, setViewPayment] = useState<SalaryPayment | null>(null);

  const reloadPayments = async () => {
    const from = histFromDate ? new Date(`${histFromDate}T00:00:00`) : undefined;
    const to = histToDate ? new Date(`${histToDate}T23:59:59.999`) : undefined;
    const p = await getSalaryPayments({ fromDate: from, toDate: to, userId: histUserFilter || undefined });
    setPayments(p);
  };

  useEffect(() => {
    if (!canView) { setHistLoading(false); return; }
    setHistLoading(true);
    reloadPayments().then(() => setHistLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, histFromDate, histToDate, histUserFilter]);

  useEffect(() => {
    setHistPage(1);
  }, [histFromDate, histToDate, histUserFilter]);

  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const histTotalPages = Math.max(1, Math.ceil(payments.length / PAGE_SIZE));
  const paginatedPayments = payments.slice((histPage - 1) * PAGE_SIZE, histPage * PAGE_SIZE);

  const handleDeletePayment = async () => {
    if (!deletePaymentId) return;
    setDeletingPayment(true);
    try {
      await deleteSalaryPayment(deletePaymentId);
      setPayments((prev) => prev.filter((p) => p.id !== deletePaymentId));
      setDeletePaymentId(null);
    } catch (err: any) {
      alert(err?.message || "Failed to delete salary payment");
    }
    setDeletingPayment(false);
  };

  const handleSendEmail = async (paymentId: string) => {
    if (!user) return;
    setSendingEmailId(paymentId);
    setEmailNotice("");
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/salary/send-payslip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, salaryPaymentId: paymentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send email");
      setPayments((prev) => prev.map((p) => (p.id === paymentId ? { ...p, emailSentAt: new Date() } : p)));
      setEmailNotice("Payslip email sent.");
    } catch (err: any) {
      setEmailNotice(err?.message || "Failed to send email.");
    }
    setSendingEmailId(null);
  };

  const handleExportHistory = () => {
    const rows = payments.map((p) => ({
      "Payment No.": p.paymentNo,
      Employee: p.userName,
      Role: p.userRole,
      Type: TYPE_LABEL[p.type] || p.type,
      Amount: p.amount,
      "Commission Base": p.commissionBase ?? "",
      "Commission %": p.commissionPercent ?? "",
      Period: p.periodLabel,
      Note: p.note,
      "Issued By": p.issuedByName,
      Drawer: p.shiftNo || "",
      Date: p.createdAt,
    }));
    downloadCSV(`salary-payments-${histFromDate}_to_${histToDate}.csv`, rowsToCSV(rows));
  };

  // ─── Employee Setup ─────────────────────────────────────────────────────
  const [editSetupUser, setEditSetupUser] = useState<UserProfile | null>(null);
  const [editSetupType, setEditSetupType] = useState<SalaryType>("monthly");
  const [editSetupMonthlyAmount, setEditSetupMonthlyAmount] = useState("");
  const [editSetupCommissionPercent, setEditSetupCommissionPercent] = useState("");
  const [savingSetup, setSavingSetup] = useState(false);
  const [setupError, setSetupError] = useState("");

  const openEditSetup = (u: UserProfile) => {
    setEditSetupUser(u);
    setEditSetupType(u.salarySetup?.type || "monthly");
    setEditSetupMonthlyAmount(u.salarySetup?.monthlyAmount != null ? String(u.salarySetup.monthlyAmount) : "");
    setEditSetupCommissionPercent(u.salarySetup?.commissionPercent != null ? String(u.salarySetup.commissionPercent) : "");
    setSetupError("");
  };

  const handleSaveSetup = async () => {
    if (!editSetupUser) return;
    setSavingSetup(true);
    setSetupError("");
    try {
      const setup: SalarySetup = {
        type: editSetupType,
        monthlyAmount: editSetupMonthlyAmount ? Number(editSetupMonthlyAmount) : undefined,
        commissionPercent: editSetupCommissionPercent ? Number(editSetupCommissionPercent) : undefined,
      };
      await setSalarySetup(editSetupUser.uid, setup);
      setPayableUsers((prev) => prev.map((u) => (u.uid === editSetupUser.uid ? { ...u, salarySetup: setup } : u)));
      setEditSetupUser(null);
    } catch (err: any) {
      setSetupError(err?.message || "Failed to save salary setup");
    }
    setSavingSetup(false);
  };

  const handleClearSetup = async () => {
    if (!editSetupUser) return;
    setSavingSetup(true);
    setSetupError("");
    try {
      await clearSalarySetup(editSetupUser.uid);
      setPayableUsers((prev) => prev.map((u) => (u.uid === editSetupUser.uid ? { ...u, salarySetup: undefined } : u)));
      setEditSetupUser(null);
    } catch (err: any) {
      setSetupError(err?.message || "Failed to clear salary setup");
    }
    setSavingSetup(false);
  };

  if (!canView) {
    return (
      <div className="p-4 sm:p-8">
        <div className="nexora-card p-8 text-center max-w-md mx-auto">
          <Banknote size={24} className="text-zinc-300 mx-auto mb-3" />
          <h1 className="font-prata text-lg text-ink mb-1">Access Restricted</h1>
          <p className="text-sm text-zinc-500">Only Admin and above can view Salary.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <h1 className="font-prata text-2xl text-ink">Salary</h1>
        <div className="flex items-center gap-1 bg-zinc-100 rounded p-1">
          {(["issue", "history", "setup"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded capitalize transition-colors ${
                tab === t ? "bg-white text-ink shadow-sm" : "text-zinc-500 hover:text-ink"
              }`}
            >
              {t === "issue" ? "Issue Salary" : t === "history" ? "Payment History" : "Employee Setup"}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Issue Salary tab ─── */}
      {tab === "issue" && (
        <div className="max-w-lg">
          {!canIssue && (
            <p className="text-sm text-zinc-500 mb-4">You don't have permission to issue salary payments.</p>
          )}
          <div className="nexora-card p-5 space-y-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Employee</label>
              <select
                className="nexora-input"
                value={issueUserId}
                onChange={(e) => handleSelectIssueUser(e.target.value)}
                disabled={!canIssue || usersLoading}
              >
                <option value="">{usersLoading ? "Loading…" : "Select employee"}</option>
                {payableUsers.map((u) => (
                  <option key={u.uid} value={u.uid}>{u.displayName} — {u.role}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Type</label>
              <select
                className="nexora-input"
                value={issueType}
                onChange={(e) => setIssueType(e.target.value as SalaryType)}
                disabled={!canIssue}
              >
                <option value="monthly">Monthly Salary</option>
                <option value="commission">Commission</option>
                <option value="hybrid">Hybrid (Monthly + Commission)</option>
              </select>
            </div>

            {(issueType === "monthly" || issueType === "hybrid") && (
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Monthly Amount (Rs.)</label>
                <input
                  type="number" min={0} className="nexora-input"
                  value={issueMonthlyAmount}
                  onChange={(e) => setIssueMonthlyAmount(e.target.value)}
                  disabled={!canIssue}
                />
              </div>
            )}

            {(issueType === "commission" || issueType === "hybrid") && (
              <>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">1. Link Sales / Jobs</label>
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      className="nexora-input pl-8 text-sm"
                      placeholder="Search sale invoice no., job no. or customer…"
                      value={commissionSearch}
                      onChange={(e) => setCommissionSearch(e.target.value)}
                      disabled={!canIssue}
                    />
                  </div>
                  {commissionPoolLoading && <p className="text-xs text-zinc-400 mt-1">Loading sales & jobs…</p>}

                  {commissionSearch.trim().length >= 2 &&
                    (commissionSearchResults.sales.length > 0 || commissionSearchResults.jobs.length > 0) && (
                      <div className="mt-1 border border-zinc-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-zinc-50 bg-white shadow-sm">
                        {commissionSearchResults.sales.map((s: any) => (
                          <button
                            type="button"
                            key={`sale-${s.id}`}
                            onClick={() => addCommissionItem("sale", s)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 flex items-center justify-between gap-2"
                          >
                            <span className="truncate">
                              <span className="text-zinc-400 mr-1">Sale</span>
                              <span className="font-medium">{s.invoiceNo}</span>
                              {s.customerName && <span className="text-zinc-400"> — {s.customerName}</span>}
                            </span>
                            <span className="text-zinc-500 shrink-0">Rs. {(s.totalAmount || 0).toLocaleString()}</span>
                          </button>
                        ))}
                        {commissionSearchResults.jobs.map((j: any) => (
                          <button
                            type="button"
                            key={`job-${j.id}`}
                            onClick={() => addCommissionItem("job", j)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 flex items-center justify-between gap-2"
                          >
                            <span className="truncate">
                              <span className="text-zinc-400 mr-1">Job</span>
                              <span className="font-medium">{j.jobNo}</span>
                              {j.customerName && <span className="text-zinc-400"> — {j.customerName}</span>}
                            </span>
                            <span className="text-zinc-500 shrink-0">
                              Rs. {((j.repairCost ?? j.estimatedCost) || 0).toLocaleString()}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                  {commissionSearch.trim().length >= 2 &&
                    !commissionPoolLoading &&
                    commissionSearchResults.sales.length === 0 &&
                    commissionSearchResults.jobs.length === 0 && (
                      <p className="text-xs text-zinc-400 mt-1">No matching sale/job found (or already linked to a commission).</p>
                    )}

                  {commissionItems.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {commissionItems.map((item) => (
                        <div
                          key={`${item.kind}-${item.id}`}
                          className="flex items-center justify-between gap-2 bg-zinc-50 rounded px-2.5 py-1.5 text-xs"
                        >
                          <span className="truncate">
                            <span className="text-zinc-400 capitalize mr-1">{item.kind}</span>
                            <span className="font-medium">{item.number}</span>
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-zinc-500">Rs. {item.amount.toLocaleString()}</span>
                            <button
                              type="button"
                              onClick={() => removeCommissionItem(item.kind, item.id)}
                              className="text-zinc-300 hover:text-red-500"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="text-xs pt-1">
                        <span className="text-zinc-500">
                          Selected total (Commission Base): <span className="font-medium text-ink">Rs. {commissionItemsTotal.toLocaleString()}</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Commission Base (Rs.)</label>
                    <input
                      type="number" min={0} className="nexora-input disabled:bg-zinc-50 disabled:text-zinc-500"
                      placeholder="e.g. sales total for period"
                      value={issueCommissionBase}
                      onChange={(e) => setIssueCommissionBase(e.target.value)}
                      disabled={!canIssue || commissionItems.length > 0}
                    />
                    {commissionItems.length > 0 && (
                      <p className="text-[11px] text-zinc-400 mt-1">Auto-filled from the sales/jobs linked above.</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">2. Commission %</label>
                    <input
                      type="number" min={0} max={100} step={0.1} className="nexora-input"
                      value={issueCommissionPercent}
                      onChange={(e) => setIssueCommissionPercent(e.target.value)}
                      disabled={!canIssue}
                    />
                  </div>
                </div>
                <p className="text-xs text-zinc-400">Commission amount = Rs. {commissionAmount.toLocaleString()}</p>
              </>
            )}

            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Amount to Pay (Rs.)</label>
              <input
                type="number" min={0} className="nexora-input font-medium"
                value={issueAmount}
                onChange={(e) => setIssueAmount(e.target.value)}
                disabled={!canIssue}
              />
            </div>

            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Period</label>
              <input
                className="nexora-input"
                placeholder="e.g. August 2026"
                value={issuePeriodLabel}
                onChange={(e) => setIssuePeriodLabel(e.target.value)}
                disabled={!canIssue}
              />
            </div>

            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Note (optional)</label>
              <input
                className="nexora-input"
                value={issueNote}
                onChange={(e) => setIssueNote(e.target.value)}
                disabled={!canIssue}
              />
            </div>

            <div className="border-t border-zinc-100 pt-3">
              <label className="flex items-center gap-2 text-xs text-zinc-600">
                <input
                  type="checkbox"
                  checked={paidFromDrawer}
                  disabled={!canIssue}
                  onChange={(e) => { setPaidFromDrawer(e.target.checked); if (!e.target.checked) setIssueShiftId(""); }}
                />
                Paid out of a cashier's till
              </label>
              {paidFromDrawer && (
                <div className="mt-2">
                  <label className="text-xs text-zinc-500 mb-1 block">Which shift?</label>
                  {loadingOpenShifts ? (
                    <p className="text-xs text-zinc-400">Loading open shifts…</p>
                  ) : openShiftsForSalary.length === 0 ? (
                    <p className="text-xs text-amber-600">No open shifts right now — this can't be debited from a drawer.</p>
                  ) : (
                    <select className="nexora-input" value={issueShiftId} onChange={(e) => setIssueShiftId(e.target.value)}>
                      <option value="">Select a shift…</option>
                      {openShiftsForSalary.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.shiftNo} — {s.cashierName}
                          {daysOpen(s.openedAt) >= 1 ? ` (open ${daysOpen(s.openedAt)}d — check this is still live)` : " (opened today)"}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-[11px] text-zinc-400 mt-1">This amount is deducted from that shift's expected cash at close.</p>
                </div>
              )}
            </div>

            {issueError && <p className="text-xs text-red-600">{issueError}</p>}
            {issueSuccess && (
              <p className="text-xs text-green-600 flex items-center gap-1"><Check size={12} /> Issued as {issueSuccess}</p>
            )}

            {canIssue && (
              <button onClick={handleIssue} disabled={issuing} className="nexora-btn nexora-btn-primary w-full justify-center">
                {issuing ? "Issuing…" : "Issue Salary Payment"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Payment History tab ─── */}
      {tab === "history" && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <p className="text-zinc-500 text-sm">{payments.length} payments in range</p>
            <div className="sm:text-right">
              <p className="text-xs text-zinc-400 uppercase tracking-wider">Total Paid</p>
              <p className="font-poppins font-semibold text-xl text-ink">Rs. {totalPaid.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <input type="date" aria-label="From date" className="nexora-input w-auto" value={histFromDate} max={histToDate || undefined} onChange={(e) => setHistFromDate(e.target.value)} />
            <span className="text-zinc-300 text-xs">–</span>
            <input type="date" aria-label="To date" className="nexora-input w-auto" value={histToDate} min={histFromDate || undefined} onChange={(e) => setHistToDate(e.target.value)} />
            <select className="nexora-input w-auto" value={histUserFilter} onChange={(e) => setHistUserFilter(e.target.value)}>
              <option value="">All employees</option>
              {payableUsers.map((u) => <option key={u.uid} value={u.uid}>{u.displayName}</option>)}
            </select>
            {histUserFilter && (
              <button onClick={() => setHistUserFilter("")} className="nexora-btn nexora-btn-ghost text-xs py-2">Clear</button>
            )}
            <button onClick={handleExportHistory} disabled={payments.length === 0} className="nexora-btn nexora-btn-outline text-xs ml-auto disabled:opacity-50 disabled:cursor-not-allowed">
              <Download size={12} /> Download CSV
            </button>
          </div>

          {emailNotice && <p className="text-xs text-zinc-500 mb-3">{emailNotice}</p>}

          <div className="nexora-card overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Payment No.</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Employee</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Amount</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Period</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Issued By</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Date</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {histLoading ? (
                  <tr><td colSpan={8} className="text-center py-10 text-zinc-400">Loading…</td></tr>
                ) : paginatedPayments.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-zinc-400">No salary payments found</td></tr>
                ) : (
                  paginatedPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-ink">{p.paymentNo}</td>
                      <td className="px-4 py-3 text-zinc-600">{p.userName} <span className="text-xs text-zinc-400">({p.userRole})</span></td>
                      <td className="px-4 py-3">{TYPE_LABEL[p.type] || p.type}</td>
                      <td className="px-4 py-3 font-medium">Rs. {p.amount?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-zinc-600">{p.periodLabel}</td>
                      <td className="px-4 py-3 text-zinc-600">{p.issuedByName}</td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(p.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setViewPayment(p)}
                            title="View full details"
                            className="text-zinc-300 hover:text-ink transition-colors"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => handleSendEmail(p.id)}
                            disabled={sendingEmailId === p.id}
                            title={p.emailSentAt ? "Resend payslip email" : "Send payslip email"}
                            className={`transition-colors ${p.emailSentAt ? "text-green-500 hover:text-green-600" : "text-zinc-300 hover:text-ink"}`}
                          >
                            {sendingEmailId === p.id ? <span className="text-xs">…</span> : <Mail size={14} />}
                          </button>
                          {canDelete && (
                            <button onClick={() => setDeletePaymentId(p.id)} className="text-zinc-300 hover:text-red-500 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination page={histPage} totalPages={histTotalPages} totalItems={payments.length} pageSize={PAGE_SIZE} onPageChange={setHistPage} />
        </div>
      )}

      {/* ─── Employee Setup tab ─── */}
      {tab === "setup" && (
        <div>
          <p className="text-zinc-500 text-sm mb-4">Set a default monthly amount and/or commission % for each employee, so the Issue Salary form pre-fills automatically.</p>
          <div className="nexora-card overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Employee</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Role</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Salary Setup</th>
                  {canManageConfig && <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {usersLoading ? (
                  <tr><td colSpan={4} className="text-center py-10 text-zinc-400">Loading…</td></tr>
                ) : payableUsers.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-10 text-zinc-400">No employees found</td></tr>
                ) : (
                  payableUsers.map((u) => (
                    <tr key={u.uid} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-ink">{u.displayName}</td>
                      <td className="px-4 py-3 text-zinc-600">{u.role}</td>
                      <td className="px-4 py-3 text-zinc-600">
                        {u.salarySetup ? (
                          <>
                            {TYPE_LABEL[u.salarySetup.type]}
                            {u.salarySetup.monthlyAmount != null && ` · Rs. ${u.salarySetup.monthlyAmount.toLocaleString()}/mo`}
                            {u.salarySetup.commissionPercent != null && ` · ${u.salarySetup.commissionPercent}% commission`}
                          </>
                        ) : (
                          <span className="text-zinc-400">Not configured</span>
                        )}
                      </td>
                      {canManageConfig && (
                        <td className="px-4 py-3">
                          <button onClick={() => openEditSetup(u)} className="nexora-btn nexora-btn-outline text-xs py-1.5">Edit</button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit setup modal */}
      {editSetupUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
              <h2 className="font-prata text-base">Salary Setup — {editSetupUser.displayName}</h2>
              <button onClick={() => setEditSetupUser(null)}><X size={16} className="text-zinc-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Type</label>
                <select className="nexora-input" value={editSetupType} onChange={(e) => setEditSetupType(e.target.value as SalaryType)}>
                  <option value="monthly">Monthly Salary</option>
                  <option value="commission">Commission</option>
                  <option value="hybrid">Hybrid (Monthly + Commission)</option>
                </select>
              </div>
              {(editSetupType === "monthly" || editSetupType === "hybrid") && (
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Monthly Amount (Rs.)</label>
                  <input type="number" min={0} className="nexora-input" value={editSetupMonthlyAmount} onChange={(e) => setEditSetupMonthlyAmount(e.target.value)} />
                </div>
              )}
              {(editSetupType === "commission" || editSetupType === "hybrid") && (
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Commission %</label>
                  <input type="number" min={0} max={100} step={0.1} className="nexora-input" value={editSetupCommissionPercent} onChange={(e) => setEditSetupCommissionPercent(e.target.value)} />
                </div>
              )}
              {setupError && <p className="text-xs text-red-600">{setupError}</p>}
              <button onClick={handleSaveSetup} disabled={savingSetup} className="nexora-btn nexora-btn-primary w-full justify-center">
                {savingSetup ? "Saving…" : "Save"}
              </button>
              {editSetupUser.salarySetup && (
                <button onClick={handleClearSetup} disabled={savingSetup} className="nexora-btn nexora-btn-ghost w-full justify-center text-red-600">
                  Clear Setup (mark as Not configured)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View payment detail modal */}
      {viewPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 sticky top-0 bg-white">
              <h2 className="font-prata text-base">{viewPayment.paymentNo}</h2>
              <button onClick={() => setViewPayment(null)}><X size={16} className="text-zinc-400" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-zinc-50 rounded p-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-zinc-500">Employee</span><span className="font-medium">{viewPayment.userName}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Role</span><span>{viewPayment.userRole}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Type</span><span>{TYPE_LABEL[viewPayment.type] || viewPayment.type}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Period</span><span>{viewPayment.periodLabel}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Issued By</span><span>{viewPayment.issuedByName}</span></div>
                {viewPayment.shiftNo && (
                  <div className="flex justify-between"><span className="text-zinc-500">Paid from till</span><span>{viewPayment.shiftNo}</span></div>
                )}
                <div className="flex justify-between"><span className="text-zinc-500">Date</span><span>{formatDate(viewPayment.createdAt)}</span></div>
              </div>

              <div>
                <h3 className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-2">How this amount was calculated</h3>
                <div className="border border-zinc-100 rounded divide-y divide-zinc-50 text-sm">
                  {(viewPayment.type === "monthly" || viewPayment.type === "hybrid") && (
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-zinc-500">Monthly amount</span>
                      <span>Rs. {((viewPayment.type === "hybrid"
                        ? viewPayment.amount - (((viewPayment.commissionBase || 0) * (viewPayment.commissionPercent || 0)) / 100)
                        : viewPayment.amount) || 0).toLocaleString()}</span>
                    </div>
                  )}
                  {(viewPayment.type === "commission" || viewPayment.type === "hybrid") && (
                    <>
                      <div className="flex justify-between px-3 py-2">
                        <span className="text-zinc-500">Commission base</span>
                        <span>Rs. {(viewPayment.commissionBase ?? 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between px-3 py-2">
                        <span className="text-zinc-500">Commission %</span>
                        <span>{viewPayment.commissionPercent ?? 0}%</span>
                      </div>
                      <div className="flex justify-between px-3 py-2">
                        <span className="text-zinc-500">Commission amount</span>
                        <span>Rs. {(((viewPayment.commissionBase || 0) * (viewPayment.commissionPercent || 0)) / 100).toLocaleString()}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between px-3 py-2 font-medium bg-zinc-50">
                    <span>Total paid</span>
                    <span>Rs. {viewPayment.amount?.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {viewPayment.commissionItems && viewPayment.commissionItems.length > 0 && (
                <div>
                  <h3 className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-2">Linked sales / jobs</h3>
                  <div className="border border-zinc-100 rounded overflow-hidden text-sm">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-1.5 text-[11px] text-zinc-400 uppercase tracking-wider bg-zinc-50">
                      <span>Item</span>
                      <span className="text-right">Base</span>
                      <span className="text-right">Commission</span>
                    </div>
                    <div className="divide-y divide-zinc-50">
                      {viewPayment.commissionItems.map((item) => (
                        <div key={`${item.kind}-${item.id}`} className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2">
                          <span className="text-zinc-600 capitalize truncate">{item.kind} — {item.number}</span>
                          <span className="text-right text-zinc-500">Rs. {item.amount.toLocaleString()}</span>
                          <span className="text-right font-medium">
                            Rs. {((item.amount * (viewPayment.commissionPercent || 0)) / 100).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 font-medium bg-zinc-50 border-t border-zinc-100">
                      <span>Total ({viewPayment.commissionPercent ?? 0}%)</span>
                      <span className="text-right">Rs. {(viewPayment.commissionBase ?? 0).toLocaleString()}</span>
                      <span className="text-right">
                        Rs. {(((viewPayment.commissionBase || 0) * (viewPayment.commissionPercent || 0)) / 100).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {viewPayment.note && (
                <div>
                  <h3 className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1">Note</h3>
                  <p className="text-sm text-zinc-700">{viewPayment.note}</p>
                </div>
              )}

              <p className="text-xs text-zinc-400">
                {viewPayment.emailSentAt ? "Payslip email sent to this employee." : "No payslip email sent yet."}
              </p>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deletePaymentId}
        title="Delete salary payment?"
        message="This payment and its linked Finance expense entry will be permanently removed. This action cannot be undone."
        loading={deletingPayment}
        onConfirm={handleDeletePayment}
        onCancel={() => setDeletePaymentId(null)}
      />
    </div>
  );
}
