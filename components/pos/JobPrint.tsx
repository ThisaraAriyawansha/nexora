import React, { useEffect, useState } from "react";
import { getShopSettings } from "@/lib/firestore";
import type { ShopSettings } from "@/types";

interface JobPrintProps {
  job: any;
}

const DEFAULT_SHOP: ShopSettings = { name: "Nexora", phone: "", email: "", address: "" };

function formatDate(ts: any) {
  if (!ts) return "________";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Job Pending",
  ongoing: "Ongoing Job",
  done: "Job Done",
  unrepairable: "Can't Repair",
};

export default function JobPrint({ job }: JobPrintProps) {
  const [shop, setShop] = useState<ShopSettings>(DEFAULT_SHOP);

  useEffect(() => {
    getShopSettings().then((s) => {
      if (s) setShop(s);
    });
  }, []);

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const device = job.deviceType === "Other" ? job.deviceTypeOther : job.deviceType;
  const balance = Math.max(0, (job.repairCost ?? job.estimatedCost ?? 0) - (job.advancePaid ?? 0));

  return (
    <div id="job-print" style={{ fontFamily: "'Poppins', sans-serif", padding: "15mm", width: "210mm", minHeight: "297mm", background: "#fff", color: "#000", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div className="job-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4mm", paddingBottom: "3mm", borderBottom: "2px solid #000" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "3.5mm" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/shop_logo/6767467478-removebg-preview.png" alt={shop.name} style={{ height: "20mm", width: "auto", objectFit: "contain" }} />
          <div>
            <div className="job-title" style={{ fontFamily: "'Poppins', sans-serif", fontSize: "18pt", fontWeight: 700, letterSpacing: "-0.3px", lineHeight: 1.2 }}>{shop.name}</div>
            {shop.address && <div style={{ fontSize: "8pt", color: "#555", marginTop: "2px" }}>{shop.address}</div>}
            <div style={{ fontSize: "7.5pt", color: "#888", marginTop: "1px" }}>
              {shop.phone && <>Tel: {shop.phone}</>}
              {shop.phone && shop.email && " | "}
              {shop.email}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "8pt", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "2px" }}>Service Job Note</div>
          <div style={{ fontSize: "14pt", fontFamily: "'Prata', serif", fontWeight: "400" }}>{job.jobNo}</div>
          <div style={{ fontSize: "7.5pt", color: "#666", marginTop: "3px" }}>{dateStr}</div>
          <div style={{ fontSize: "7.5pt", color: "#666" }}>{timeStr}</div>
        </div>
      </div>

      {/* Customer & Status */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8mm", marginBottom: "3mm" }}>
        <div>
          <div style={{ fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: "0.08em", color: "#888", marginBottom: "2px" }}>Customer Details</div>
          <div style={{ fontSize: "9.5pt", fontWeight: "600" }}>{job.customerName}</div>
          {job.customerCompany && <div style={{ fontSize: "8.5pt", color: "#555" }}>{job.customerCompany}</div>}
          <div style={{ fontSize: "8.5pt", color: "#555" }}>{job.customerPhone}</div>
          {job.customerEmail && <div style={{ fontSize: "8.5pt", color: "#555" }}>{job.customerEmail}</div>}
          {(job.customerAddress || job.customerCity) && (
            <div style={{ fontSize: "8.5pt", color: "#555" }}>{[job.customerAddress, job.customerCity].filter(Boolean).join(", ")}</div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: "0.08em", color: "#888", marginBottom: "2px" }}>Status</div>
          <div style={{ fontSize: "9.5pt", fontWeight: "600" }}>{STATUS_LABEL[job.status] ?? job.status}</div>
          <div style={{ fontSize: "8.5pt", color: "#555", marginTop: "2px" }}>Received By: {job.receivedByName?.includes("@") ? "Staff" : job.receivedByName}</div>
          {job.assignedTechnicianName && <div style={{ fontSize: "8.5pt", color: "#555" }}>Technician: {job.assignedTechnicianName}</div>}
          {job.expectedDeliveryDate && <div style={{ fontSize: "8.5pt", color: "#555" }}>Expected: {formatDate(job.expectedDeliveryDate)}</div>}
        </div>
      </div>

      {/* Device details */}
      <table className="job-table" style={{ width: "100%", borderCollapse: "collapse", marginBottom: "4mm" }}>
        <thead>
          <tr>
            <th style={{ borderBottom: "1.5pt solid #000", padding: "1.5mm 2mm", textAlign: "left", fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>Device</th>
            <th style={{ borderBottom: "1.5pt solid #000", padding: "1.5mm 2mm", textAlign: "left", fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>Brand</th>
            <th style={{ borderBottom: "1.5pt solid #000", padding: "1.5mm 2mm", textAlign: "left", fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>Model</th>
            <th style={{ borderBottom: "1.5pt solid #000", padding: "1.5mm 2mm", textAlign: "left", fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>Serial No.</th>
            <th style={{ borderBottom: "1.5pt solid #000", padding: "1.5mm 2mm", textAlign: "left", fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>Color</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: "1.5mm 2mm", fontSize: "9.5pt" }}>{device || "—"}</td>
            <td style={{ padding: "1.5mm 2mm", fontSize: "9.5pt" }}>{job.brand || "—"}</td>
            <td style={{ padding: "1.5mm 2mm", fontSize: "9.5pt" }}>{job.model || "—"}</td>
            <td style={{ padding: "1.5mm 2mm", fontSize: "9.5pt" }}>{job.serialNo || "—"}</td>
            <td style={{ padding: "1.5mm 2mm", fontSize: "9.5pt" }}>{job.color || "—"}</td>
          </tr>
        </tbody>
      </table>

      {/* Fault */}
      <div style={{ marginBottom: "3mm" }}>
        <div style={{ fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: "0.08em", color: "#888", marginBottom: "1mm" }}>Fault / Customer Complaint</div>
        <div style={{ fontSize: "9.5pt", lineHeight: 1.5 }}>{job.faultDescription}</div>
      </div>

      {/* Accessories & condition */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8mm", marginBottom: "3mm" }}>
        <div>
          <div style={{ fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: "0.08em", color: "#888", marginBottom: "1mm" }}>Accessories Received</div>
          <div style={{ fontSize: "9pt" }}>
            {[...(job.accessories || []), job.accessoriesOther].filter(Boolean).join(", ") || "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: "0.08em", color: "#888", marginBottom: "1mm" }}>Physical Condition</div>
          <div style={{ fontSize: "9pt" }}>{(job.physicalCondition || []).join(", ") || "—"}</div>
        </div>
      </div>

      {job.specialNotes && (
        <div style={{ fontSize: "9pt", color: "#555", marginBottom: "3mm" }}>
          <span style={{ fontWeight: "600" }}>Special Notes: </span>{job.specialNotes}
        </div>
      )}

      {/* Costs */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "4mm", breakInside: "avoid", pageBreakInside: "avoid" }}>
        <div style={{ width: "60mm" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9pt", padding: "1.5mm 0", color: "#555" }}>
            <span>Estimated Cost</span>
            <span>Rs. {job.estimatedCost?.toLocaleString()}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9pt", padding: "1.5mm 0", color: "#555" }}>
            <span>Advance Paid</span>
            <span>Rs. {job.advancePaid?.toLocaleString()}</span>
          </div>
          {job.repairCost != null && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9pt", padding: "1.5mm 0", color: "#555" }}>
              <span>Repair Cost</span>
              <span>Rs. {job.repairCost?.toLocaleString()}</span>
            </div>
          )}
          <hr style={{ border: "none", borderTop: "1.5pt solid #000", margin: "3mm 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13pt", fontFamily: "'Prata', serif", fontWeight: "400" }}>
            <span>Balance</span>
            <span>Rs. {balance.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Bottom section: terms, signatures, footer. See BillPrint.tsx for why
          marginTop:auto here is safe for the download flow but overridden
          back to normal flow for native browser print in @media print. */}
      <div className="job-signature-block" style={{ marginTop: "auto" }}>
        <div style={{ background: "#f9f9f9", border: "0.5pt solid #e4e4e7", borderRadius: "2mm", padding: "2mm 3.5mm", marginBottom: "3mm", breakInside: "avoid", pageBreakInside: "avoid" }}>
          <div style={{ fontSize: "7.5pt", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.8mm" }}>Terms &amp; Conditions</div>
          <div style={{ fontSize: "6.8pt", color: "#555", lineHeight: 1.5 }}>
            Keep this Job Note for item collection. We are not responsible for data loss. Provide passwords/PINs for testing. Service charges apply even if repair is declined. Uncollected items after 30 days are not the responsibility of the service center. Warranty covers repaired/replaced parts only. No warranty for physical, liquid, electrical, accidental, or software damage. Warranty is void if the warranty sticker or serial number is removed or damaged. Customer signature confirms acceptance of these terms.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10mm", marginTop: "14mm", marginBottom: "4mm", breakInside: "avoid", pageBreakInside: "avoid" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderTop: "1px dotted #000", width: "55mm", margin: "0 auto 1mm" }} />
            <div style={{ fontSize: "8pt", fontWeight: "600" }}>(Technician / Received By Signature)</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderTop: "1px dotted #000", width: "55mm", margin: "0 auto 1mm" }} />
            <div style={{ fontSize: "8pt", fontWeight: "600" }}>(Customer Signature)</div>
          </div>
        </div>

        <div style={{ borderTop: "1pt solid #e4e4e7", paddingTop: "3mm", display: "flex", justifyContent: "space-between", alignItems: "flex-end", breakInside: "avoid", pageBreakInside: "avoid" }}>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: "10pt", fontWeight: 600, color: "#000" }}>{shop.name}</div>
            <div style={{ fontSize: "7pt", color: "#888", marginTop: "1px" }}>Thank you for trusting us with your repair!</div>
          </div>
          <div style={{ textAlign: "right" }}>
            {shop.email && <div style={{ fontSize: "7pt", color: "#aaa" }}>Support: {shop.email}</div>}
            <div style={{ fontSize: "7pt", color: "#aaa", marginTop: "1px" }}>Copyright © {now.getFullYear()} {shop.name}. All Rights Reserved.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
