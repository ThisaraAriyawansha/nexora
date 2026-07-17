"use client";
import { useEffect, useState, useRef } from "react";
import {
  getCustomers, getTechnicians, getJobs, getJob, createJob, updateJobStatus, getAllJobsWithHistory,
} from "@/lib/firestore";
import type { Customer, JobStatus, UserProfile } from "@/types";
import {
  Search, Printer, Eye, X, Plus, Wrench, Download, FileDown,
} from "lucide-react";
import JobPrint from "@/components/pos/JobPrint";
import { useReactToPrint } from "react-to-print";
import Pagination from "@/components/ui/Pagination";
import { useAuth } from "@/hooks/useAuth";
import { downloadElementAsPdf } from "@/lib/pdf";

const PAGE_SIZE = 10;

const DEVICE_TYPES = ["Desktop", "Laptop", "Printer", "Monitor", "CCTV", "Other"];
const ACCESSORY_OPTIONS = ["Charger", "Power Cable", "Battery", "Adapter", "Bag", "Mouse", "Keyboard", "HDD/SSD"];
const CONDITION_OPTIONS = ["Good", "Scratches", "Cracked", "Broken Hinges", "Liquid Damage", "Missing Parts"];

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: "Job Pending",
  ongoing: "Ongoing Job",
  done: "Job Done",
  unrepairable: "Can't Repair",
};

const STATUS_BADGE: Record<JobStatus, string> = {
  pending: "badge-warning",
  ongoing: "badge-default",
  done: "badge-success",
  unrepairable: "badge-danger",
};

const STATUS_DOT: Record<JobStatus, string> = {
  pending: "bg-amber-400",
  ongoing: "bg-zinc-400",
  done: "bg-green-500",
  unrepairable: "bg-red-500",
};

function emptyForm() {
  return {
    customerId: null as string | null,
    customerName: "",
    customerCompany: "",
    customerAddress: "",
    customerCity: "",
    customerPhone: "",
    customerEmail: "",
    deviceType: "Laptop",
    deviceTypeOther: "",
    brand: "",
    model: "",
    serialNo: "",
    color: "",
    faultDescription: "",
    accessories: [] as string[],
    accessoriesOther: "",
    physicalCondition: [] as string[],
    specialNotes: "",
    assignedTechnicianId: null as string | null,
    assignedTechnicianName: "",
    estimatedCost: 0,
    advancePaid: 0,
    expectedDeliveryDate: "",
  };
}

function toggleInList(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function formatDate(ts: any, opts?: Intl.DateTimeFormatOptions) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", opts || { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function csvEscape(value: any) {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function JobsPage() {
  const { user, userDisplayName } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [technicians, setTechnicians] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [exportingReport, setExportingReport] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [customerSearch, setCustomerSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [viewJob, setViewJob] = useState<any>(null);
  const [newStatus, setNewStatus] = useState<JobStatus>("pending");
  const [statusNote, setStatusNote] = useState("");
  const [statusCost, setStatusCost] = useState("");
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusError, setStatusError] = useState("");

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ content: () => printRef.current });
  const [downloadingJob, setDownloadingJob] = useState(false);

  const handleDownloadJob = async () => {
    if (!printRef.current || downloadingJob) return;
    setDownloadingJob(true);
    try {
      await downloadElementAsPdf(printRef.current, `${viewJob?.jobNo || "job"}.pdf`);
    } finally {
      setDownloadingJob(false);
    }
  };

  const loadJobs = () => getJobs().then((j) => { setJobs(j); setLoading(false); });

  useEffect(() => {
    loadJobs();
    getCustomers().then((c) => setCustomers(c as Customer[]));
    getTechnicians().then(setTechnicians);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, fromDate, toDate]);

  const resetForm = () => {
    setForm(emptyForm());
    setCustomerSearch("");
    setSaveError("");
  };

  const openCreate = () => {
    resetForm();
    setShowCreate(true);
  };

  const filteredCustomers = customerSearch
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
          c.phone?.toLowerCase().includes(customerSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  const pickCustomer = (c: Customer) => {
    setForm((f) => ({
      ...f,
      customerId: c.id,
      customerName: c.name,
      customerPhone: c.phone || "",
      customerEmail: c.email || "",
      customerAddress: c.address || "",
    }));
    setCustomerSearch("");
  };

  const handleCreate = async () => {
    setSaveError("");
    if (!form.customerName.trim() || !form.customerPhone.trim()) {
      setSaveError("Customer name and mobile number are required.");
      return;
    }
    if (!form.faultDescription.trim()) {
      setSaveError("Please describe the fault / customer complaint.");
      return;
    }
    setSaving(true);
    try {
      const result = await createJob({
        customerId: form.customerId,
        customerName: form.customerName.trim(),
        customerCompany: form.customerCompany.trim(),
        customerAddress: form.customerAddress.trim(),
        customerCity: form.customerCity.trim(),
        customerPhone: form.customerPhone.trim(),
        customerEmail: form.customerEmail.trim(),
        deviceType: form.deviceType,
        deviceTypeOther: form.deviceType === "Other" ? form.deviceTypeOther.trim() : "",
        brand: form.brand.trim(),
        model: form.model.trim(),
        serialNo: form.serialNo.trim(),
        color: form.color.trim(),
        faultDescription: form.faultDescription.trim(),
        accessories: form.accessories,
        accessoriesOther: form.accessoriesOther.trim(),
        physicalCondition: form.physicalCondition,
        specialNotes: form.specialNotes.trim(),
        receivedById: user?.uid || "",
        receivedByName: userDisplayName || user?.email || "Staff",
        assignedTechnicianId: form.assignedTechnicianId,
        assignedTechnicianName: form.assignedTechnicianName,
        estimatedCost: Number(form.estimatedCost) || 0,
        advancePaid: Number(form.advancePaid) || 0,
        expectedDeliveryDate: form.expectedDeliveryDate ? new Date(`${form.expectedDeliveryDate}T00:00:00`) : null,
      });
      await loadJobs();
      setShowCreate(false);
      const full = await getJob(result.jobId);
      setViewJob(full);
    } catch (err: any) {
      setSaveError(err?.message || "Failed to save the job note");
    } finally {
      setSaving(false);
    }
  };

  const openJob = async (id: string) => {
    const full = await getJob(id);
    setViewJob(full);
    setNewStatus((full as any)?.status || "pending");
    setStatusNote("");
    setStatusCost(full && (full as any).repairCost != null ? String((full as any).repairCost) : "");
    setStatusError("");
  };

  const closeJob = () => setViewJob(null);

  const handleUpdateStatus = async () => {
    if (!viewJob) return;
    setStatusUpdating(true);
    setStatusError("");
    try {
      await updateJobStatus(
        viewJob.id,
        {
          status: newStatus,
          note: statusNote.trim(),
          repairCost: statusCost.trim() === "" ? undefined : Number(statusCost),
        },
        { uid: user!.uid, name: userDisplayName || user?.email || "Staff" }
      );
      await loadJobs();
      const refreshed = await getJob(viewJob.id);
      setViewJob(refreshed);
      setStatusNote("");
    } catch (err: any) {
      setStatusError(err?.message || "Failed to update job status");
    } finally {
      setStatusUpdating(false);
    }
  };

  const filtered = jobs.filter((j) => {
    const matchesSearch =
      j.jobNo?.toLowerCase().includes(search.toLowerCase()) ||
      j.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      j.customerPhone?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (statusFilter !== "all" && j.status !== statusFilter) return false;

    if (fromDate || toDate) {
      const created = j.createdAt?.toDate ? j.createdAt.toDate() : new Date(j.createdAt);
      if (fromDate && created < new Date(`${fromDate}T00:00:00`)) return false;
      if (toDate && created > new Date(`${toDate}T23:59:59.999`)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExportReport = async () => {
    setExportingReport(true);
    try {
      const all = await getAllJobsWithHistory();
      const inRange = all.filter((j: any) => {
        const created = j.createdAt?.toDate ? j.createdAt.toDate() : new Date(j.createdAt);
        if (fromDate && created < new Date(`${fromDate}T00:00:00`)) return false;
        if (toDate && created > new Date(`${toDate}T23:59:59.999`)) return false;
        if (statusFilter !== "all" && j.status !== statusFilter) return false;
        return true;
      });

      const header = [
        "Job No", "Received Date", "Customer", "Phone", "Device", "Current Status",
        "Estimated Cost", "Repair Cost", "Activity Date", "Activity Status", "Activity Note", "Updated By",
      ];
      const rows: string[] = [header.join(",")];

      for (const job of inRange) {
        const device = job.deviceType === "Other" ? job.deviceTypeOther : job.deviceType;
        const history = job.statusHistory?.length ? job.statusHistory : [{}];
        for (const entry of history) {
          rows.push([
            csvEscape(job.jobNo),
            csvEscape(formatDate(job.createdAt)),
            csvEscape(job.customerName),
            csvEscape(job.customerPhone),
            csvEscape(device),
            csvEscape(STATUS_LABEL[job.status as JobStatus] ?? job.status),
            csvEscape(job.estimatedCost),
            csvEscape(job.repairCost ?? ""),
            csvEscape(entry.createdAt ? formatDate(entry.createdAt) : ""),
            csvEscape(entry.status ? STATUS_LABEL[entry.status as JobStatus] ?? entry.status : ""),
            csvEscape(entry.note ?? ""),
            csvEscape(entry.updatedByName ?? ""),
          ].join(","));
        }
      }

      const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const suffix = fromDate || toDate ? `_${fromDate || "start"}_to_${toDate || "now"}` : "";
      a.href = url;
      a.download = `jobs_report${suffix}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingReport(false);
    }
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-prata text-2xl text-black">Jobs</h1>
          <p className="text-zinc-500 text-sm mt-1">{jobs.length} total job notes</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportReport} disabled={exportingReport} className="nexora-btn nexora-btn-outline text-sm">
            <FileDown size={14} /> {exportingReport ? "Preparing…" : "Export Report"}
          </button>
          <button onClick={openCreate} className="nexora-btn nexora-btn-primary text-sm">
            <Plus size={14} /> New Job
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="relative flex-1 min-w-[200px] sm:max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            className="nexora-input pl-9"
            placeholder="Search job no., customer or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Filter by status"
          className="nexora-input w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Job Pending</option>
          <option value="ongoing">Ongoing Job</option>
          <option value="done">Job Done</option>
          <option value="unrepairable">Can't Repair</option>
        </select>
        <input
          type="date"
          aria-label="From date"
          className="nexora-input w-auto"
          value={fromDate}
          max={toDate || undefined}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <span className="text-zinc-300 text-xs">–</span>
        <input
          type="date"
          aria-label="To date"
          className="nexora-input w-auto"
          value={toDate}
          min={fromDate || undefined}
          onChange={(e) => setToDate(e.target.value)}
        />
        {(statusFilter !== "all" || fromDate || toDate) && (
          <button
            onClick={() => { setStatusFilter("all"); setFromDate(""); setToDate(""); }}
            className="nexora-btn nexora-btn-ghost text-xs py-2"
          >
            Clear
          </button>
        )}
      </div>

      <div className="nexora-card overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Job No</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Customer</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Device</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Received</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Est. Cost</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-zinc-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-zinc-400">No jobs found</td></tr>
            ) : (
              paginated.map((job) => (
                <tr key={job.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-black">{job.jobNo}</td>
                  <td className="px-4 py-3 text-zinc-600">{job.customerName}</td>
                  <td className="px-4 py-3 text-zinc-600">{job.deviceType === "Other" ? job.deviceTypeOther : job.deviceType}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(job.createdAt)}</td>
                  <td className="px-4 py-3 font-medium text-black">Rs. {job.estimatedCost?.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_BADGE[job.status as JobStatus] ?? "badge-default"}`}>
                      {STATUS_LABEL[job.status as JobStatus] ?? job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openJob(job.id)} className="nexora-btn nexora-btn-ghost py-1 px-2 text-xs">
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

      {/* Create job modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-zinc-100 sticky top-0 z-20 bg-white flex items-center justify-between">
              <h2 className="font-prata text-lg flex items-center gap-2"><Wrench size={16} /> New Job Note</h2>
              <button onClick={() => setShowCreate(false)} className="text-zinc-400 hover:text-black">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-4 space-y-5">
              {/* Customer search */}
              <div>
                <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Find Existing Customer</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    className="nexora-input pl-9"
                    placeholder="Search customers by name or phone…"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                  />
                  {filteredCustomers.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-zinc-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                      {filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => pickCustomer(c)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 flex items-center justify-between"
                        >
                          <span className="font-medium">{c.name}</span>
                          <span className="text-zinc-500 text-xs">{c.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Customer details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Customer Name *</label>
                  <input className="nexora-input" value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerId: null, customerName: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Mobile No. *</label>
                  <input className="nexora-input" value={form.customerPhone} onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Company (Optional)</label>
                  <input className="nexora-input" value={form.customerCompany} onChange={(e) => setForm((f) => ({ ...f, customerCompany: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Address</label>
                  <input className="nexora-input" value={form.customerAddress} onChange={(e) => setForm((f) => ({ ...f, customerAddress: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">City</label>
                  <input className="nexora-input" value={form.customerCity} onChange={(e) => setForm((f) => ({ ...f, customerCity: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Email (Optional)</label>
                  <input className="nexora-input" value={form.customerEmail} onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))} />
                </div>
              </div>

              {/* Device details */}
              <div>
                <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">Device Type</label>
                <div className="flex flex-wrap gap-2">
                  {DEVICE_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, deviceType: t }))}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${form.deviceType === t ? "bg-black text-white border-black" : "border-zinc-200 text-zinc-600 hover:border-zinc-400"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {form.deviceType === "Other" && (
                  <input
                    className="nexora-input mt-2"
                    placeholder="Specify device type"
                    value={form.deviceTypeOther}
                    onChange={(e) => setForm((f) => ({ ...f, deviceTypeOther: e.target.value }))}
                  />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Brand</label>
                  <input className="nexora-input" value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Model</label>
                  <input className="nexora-input" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Serial No.</label>
                  <input className="nexora-input" value={form.serialNo} onChange={(e) => setForm((f) => ({ ...f, serialNo: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Color</label>
                  <input className="nexora-input" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Fault / Customer Complaint *</label>
                <textarea className="nexora-input" rows={2} value={form.faultDescription} onChange={(e) => setForm((f) => ({ ...f, faultDescription: e.target.value }))} />
              </div>

              {/* Accessories */}
              <div>
                <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">Accessories Received</label>
                <div className="flex flex-wrap gap-2">
                  {ACCESSORY_OPTIONS.map((a) => (
                    <label key={a} className={`px-3 py-1.5 rounded-full text-xs border cursor-pointer transition-colors ${form.accessories.includes(a) ? "bg-black text-white border-black" : "border-zinc-200 text-zinc-600 hover:border-zinc-400"}`}>
                      <input type="checkbox" className="sr-only" checked={form.accessories.includes(a)} onChange={() => setForm((f) => ({ ...f, accessories: toggleInList(f.accessories, a) }))} />
                      {a}
                    </label>
                  ))}
                </div>
                <input
                  className="nexora-input mt-2"
                  placeholder="Other accessories"
                  value={form.accessoriesOther}
                  onChange={(e) => setForm((f) => ({ ...f, accessoriesOther: e.target.value }))}
                />
              </div>

              {/* Physical condition */}
              <div>
                <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">Physical Condition</label>
                <div className="flex flex-wrap gap-2">
                  {CONDITION_OPTIONS.map((c) => (
                    <label key={c} className={`px-3 py-1.5 rounded-full text-xs border cursor-pointer transition-colors ${form.physicalCondition.includes(c) ? "bg-black text-white border-black" : "border-zinc-200 text-zinc-600 hover:border-zinc-400"}`}>
                      <input type="checkbox" className="sr-only" checked={form.physicalCondition.includes(c)} onChange={() => setForm((f) => ({ ...f, physicalCondition: toggleInList(f.physicalCondition, c) }))} />
                      {c}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Special Notes</label>
                <textarea className="nexora-input" rows={2} value={form.specialNotes} onChange={(e) => setForm((f) => ({ ...f, specialNotes: e.target.value }))} />
              </div>

              {/* Service details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Assigned Technician</label>
                  <select
                    className="nexora-input"
                    value={form.assignedTechnicianId || ""}
                    onChange={(e) => {
                      const tech = technicians.find((t) => t.uid === e.target.value);
                      setForm((f) => ({ ...f, assignedTechnicianId: tech?.uid || null, assignedTechnicianName: tech?.displayName || "" }));
                    }}
                  >
                    <option value="">Unassigned</option>
                    {technicians.map((t) => (
                      <option key={t.uid} value={t.uid}>{t.displayName}</option>
                    ))}
                  </select>
                  {technicians.length === 0 && (
                    <p className="text-xs text-zinc-400 mt-1">No technicians yet — add one under Settings → Team with the "Technician" role.</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Expected Delivery Date</label>
                  <input type="date" className="nexora-input" value={form.expectedDeliveryDate} onChange={(e) => setForm((f) => ({ ...f, expectedDeliveryDate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Estimated Cost (Rs.)</label>
                  <input type="number" min={0} className="nexora-input" value={form.estimatedCost || ""} placeholder="0" onChange={(e) => setForm((f) => ({ ...f, estimatedCost: Number(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Advance Paid (Rs.)</label>
                  <input type="number" min={0} className="nexora-input" value={form.advancePaid || ""} placeholder="0" onChange={(e) => setForm((f) => ({ ...f, advancePaid: Number(e.target.value) || 0 }))} />
                </div>
              </div>

              <div className="flex justify-between text-sm border-t border-zinc-100 pt-3">
                <span className="text-zinc-500">Balance (Rs.)</span>
                <span className="font-medium">Rs. {Math.max(0, (Number(form.estimatedCost) || 0) - (Number(form.advancePaid) || 0)).toLocaleString()}</span>
              </div>

              {saveError && <p className="text-sm text-red-600">{saveError}</p>}

              <div className="flex gap-2 pb-2">
                <button onClick={handleCreate} disabled={saving} className="nexora-btn nexora-btn-primary text-sm disabled:opacity-50">
                  {saving ? "Saving…" : "Save Job Note"}
                </button>
                <button onClick={() => setShowCreate(false)} className="nexora-btn nexora-btn-ghost text-sm" disabled={saving}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Job detail modal */}
      {viewJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-zinc-100 sticky top-0 z-20 bg-white">
              <div className="flex items-center justify-between">
                <h2 className="font-prata text-lg">{viewJob.jobNo}</h2>
                <button onClick={closeJob} className="text-zinc-400 hover:text-black">
                  <X size={18} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <button onClick={handlePrint} className="nexora-btn nexora-btn-outline text-sm">
                  <Printer size={14} /> Print A4
                </button>
                <button onClick={handleDownloadJob} disabled={downloadingJob} className="nexora-btn nexora-btn-outline text-sm">
                  <Download size={14} /> {downloadingJob ? "Downloading…" : "Download"}
                </button>
              </div>
            </div>

            <div className="px-6 py-4 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Customer</p>
                  <p className="text-sm font-medium truncate">{viewJob.customerName}</p>
                  <p className="text-xs text-zinc-500">{viewJob.customerPhone}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Device</p>
                  <p className="text-sm font-medium">{viewJob.deviceType === "Other" ? viewJob.deviceTypeOther : viewJob.deviceType}</p>
                  <p className="text-xs text-zinc-500">{[viewJob.brand, viewJob.model].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Current Status</p>
                  <span className={`badge ${STATUS_BADGE[viewJob.status as JobStatus] ?? "badge-default"}`}>
                    {STATUS_LABEL[viewJob.status as JobStatus] ?? viewJob.status}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Technician</p>
                  <p className="text-sm font-medium">{viewJob.assignedTechnicianName || "Unassigned"}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Received By</p>
                  <p className="text-sm font-medium">{viewJob.receivedByName?.includes("@") ? "Staff" : viewJob.receivedByName}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Fault / Complaint</p>
                <p className="text-sm">{viewJob.faultDescription}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-zinc-100 pt-4">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Estimated Cost</p>
                  <p className="text-sm font-medium">Rs. {viewJob.estimatedCost?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Advance Paid</p>
                  <p className="text-sm font-medium">Rs. {viewJob.advancePaid?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Repair Cost</p>
                  <p className="text-sm font-medium">{viewJob.repairCost != null ? `Rs. ${viewJob.repairCost.toLocaleString()}` : "—"}</p>
                </div>
              </div>

              {/* Status update form */}
              <div className="border-t border-zinc-100 pt-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Update Job Status</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    className="nexora-input"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as JobStatus)}
                  >
                    <option value="pending">Job Pending</option>
                    <option value="ongoing">Ongoing Job</option>
                    <option value="done">Job Done</option>
                    <option value="unrepairable">Can't Repair</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    className="nexora-input"
                    placeholder="Repair cost / price (Rs.)"
                    value={statusCost}
                    onChange={(e) => setStatusCost(e.target.value)}
                  />
                </div>
                <textarea
                  className="nexora-input mt-2"
                  rows={2}
                  placeholder="Note about this update (what was done / changed)…"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                />
                {statusError && <p className="text-xs text-red-600 mt-2">{statusError}</p>}
                <button
                  onClick={handleUpdateStatus}
                  disabled={statusUpdating}
                  className="nexora-btn nexora-btn-primary text-sm mt-2 disabled:opacity-50"
                >
                  {statusUpdating ? "Updating…" : "Save Update"}
                </button>
              </div>

              {/* Status history */}
              <div className="border-t border-zinc-100 pt-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Job History</p>
                <div>
                  {viewJob.statusHistory?.map((entry: any, i: number) => {
                    const isLast = i === viewJob.statusHistory.length - 1;
                    return (
                      <div key={entry.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${STATUS_DOT[entry.status as JobStatus] ?? "bg-zinc-400"}`} />
                          {!isLast && <span className="w-px flex-1 bg-zinc-200 my-1" />}
                        </div>
                        <div className={`min-w-0 flex-1 ${isLast ? "" : "pb-4"}`}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-black">{STATUS_LABEL[entry.status as JobStatus] ?? entry.status}</span>
                            <span className="text-xs text-zinc-400">{formatDate(entry.createdAt)}</span>
                          </div>
                          {entry.note && <p className="text-sm text-zinc-600 mt-0.5">{entry.note}</p>}
                          <p className="text-xs text-zinc-400 mt-0.5">
                            {entry.updatedByName}
                            {entry.repairCost != null ? ` · Rs. ${Number(entry.repairCost).toLocaleString()}` : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Off-screen print/PDF area (kept out of view but still rendered so html2canvas can capture it) */}
      <div style={{ position: "fixed", top: 0, left: "-10000px", zIndex: -1 }}>
        <div ref={printRef}>
          {viewJob && <JobPrint job={viewJob} />}
        </div>
      </div>
    </div>
  );
}
