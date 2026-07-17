import React, { useEffect, useState } from "react";
import { getShopSettings } from "@/lib/firestore";
import type { ShopSettings } from "@/types";

interface BillPrintProps {
  sale: any;
}

const DEFAULT_SHOP: ShopSettings = { name: "Nexora", phone: "", email: "", address: "" };

export default function BillPrint({ sale }: BillPrintProps) {
  const [shop, setShop] = useState<ShopSettings>(DEFAULT_SHOP);

  useEffect(() => {
    getShopSettings().then((s) => {
      if (s) setShop(s);
    });
  }, []);

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <div id="bill-print" style={{ fontFamily: "'Poppins', sans-serif", padding: "15mm", width: "210mm", minHeight: "297mm", background: "#fff", color: "#000", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div className="bill-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4mm", paddingBottom: "3mm", borderBottom: "2px solid #000" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "3.5mm" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/shop_logo/6767467478-removebg-preview.png" alt={shop.name} style={{ height: "20mm", width: "auto", objectFit: "contain" }} />
          <div>
            <div className="bill-title" style={{ fontFamily: "'Poppins', sans-serif", fontSize: "18pt", fontWeight: 700, letterSpacing: "-0.3px", lineHeight: 1.2 }}>{shop.name}</div>
            {shop.address && <div style={{ fontSize: "8pt", color: "#555", marginTop: "2px" }}>{shop.address}</div>}
            <div style={{ fontSize: "7.5pt", color: "#888", marginTop: "1px" }}>
              {shop.phone && <>Tel: {shop.phone}</>}
              {shop.phone && shop.email && " | "}
              {shop.email}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "8pt", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "2px" }}>Invoice</div>
          <div style={{ fontSize: "14pt", fontFamily: "'Prata', serif", fontWeight: "400" }}>{sale.invoiceNo}</div>
          <div style={{ fontSize: "7.5pt", color: "#666", marginTop: "3px" }}>{dateStr}</div>
          <div style={{ fontSize: "7.5pt", color: "#666" }}>{timeStr}</div>
        </div>
      </div>

      {/* Customer & Cashier info */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8mm", marginBottom: "3mm" }}>
        <div>
          <div style={{ fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: "0.08em", color: "#888", marginBottom: "2px" }}>Bill To</div>
          <div style={{ fontSize: "9.5pt", fontWeight: "600" }}>{sale.customerName || "Walk-in Customer"}</div>
          {sale.customerPhone && <div style={{ fontSize: "8.5pt", color: "#555" }}>{sale.customerPhone}</div>}
          {sale.customerEmail && <div style={{ fontSize: "8.5pt", color: "#555" }}>{sale.customerEmail}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          {sale.cashierName && (
            <>
              <div style={{ fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: "0.08em", color: "#888", marginBottom: "2px" }}>Served By</div>
              <div style={{ fontSize: "9.5pt", fontWeight: "600" }}>{sale.cashierName?.includes("@") ? "Cashier" : sale.cashierName}</div>
            </>
          )}
          <div style={{ fontSize: "8.5pt", color: "#555", textTransform: "capitalize" }}>Payment: {sale.paymentMethod}</div>
        </div>
      </div>

      {/* Items table */}
      <table className="bill-table" style={{ width: "100%", borderCollapse: "collapse", marginBottom: "4mm" }}>
        <thead>
          <tr>
            <th style={{ borderBottom: "1.5pt solid #000", padding: "1.5mm 2mm", textAlign: "left", fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>#</th>
            <th style={{ borderBottom: "1.5pt solid #000", padding: "1.5mm 2mm", textAlign: "left", fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>Description</th>
            <th style={{ borderBottom: "1.5pt solid #000", padding: "1.5mm 2mm", textAlign: "center", fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>Qty</th>
            <th style={{ borderBottom: "1.5pt solid #000", padding: "1.5mm 2mm", textAlign: "right", fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>Unit Price</th>
            <th style={{ borderBottom: "1.5pt solid #000", padding: "1.5mm 2mm", textAlign: "right", fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>Disc.</th>
            <th style={{ borderBottom: "1.5pt solid #000", padding: "1.5mm 2mm", textAlign: "right", fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.items?.map((item: any, i: number) => (
            <tr key={i} style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
              <td style={{ padding: "1.2mm 2mm", fontSize: "9pt", color: "#555" }}>{i + 1}</td>
              <td style={{ padding: "1.2mm 2mm", fontSize: "10pt", lineHeight: 1.35 }}>
                <div style={{ fontWeight: "500" }}>{item.productName} <span style={{ fontWeight: "400", color: "#888" }}>({item.sku})</span></div>
                {item.units?.length > 0 && (
                  <div style={{ fontSize: "7.5pt", color: "#888" }}>Serial: {item.units.map((u: any) => u.serialNumber).join(", ")}</div>
                )}
                {item.warrantyMonths > 0 && (
                  <div style={{ fontSize: "7.5pt", color: "#555" }}>Warranty: {item.warrantyMonths} month{item.warrantyMonths > 1 ? "s" : ""}</div>
                )}
              </td>
              <td style={{ padding: "1.2mm 2mm", fontSize: "10pt", textAlign: "center" }}>{item.qty}</td>
              <td style={{ padding: "1.2mm 2mm", fontSize: "10pt", textAlign: "right" }}>Rs. {item.unitPrice?.toLocaleString()}</td>
              <td style={{ padding: "1.2mm 2mm", fontSize: "10pt", textAlign: "right", color: item.discount > 0 ? "#dc2626" : "#aaa" }}>
                {item.discount > 0 ? `Rs. ${item.discount.toLocaleString()}` : "—"}
              </td>
              <td style={{ padding: "1.2mm 2mm", fontSize: "10pt", textAlign: "right", fontWeight: "600" }}>Rs. {item.lineTotal?.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "4mm", breakInside: "avoid", pageBreakInside: "avoid" }}>
        <div style={{ width: "55mm" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9pt", padding: "1.5mm 0", color: "#555" }}>
            <span>Subtotal</span>
            <span>Rs. {sale.subtotal?.toLocaleString()}</span>
          </div>
          {sale.discountAmount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9pt", padding: "1.5mm 0", color: "#dc2626" }}>
              <span>Discount</span>
              <span>- Rs. {sale.discountAmount?.toLocaleString()}</span>
            </div>
          )}
          {sale.pointsRedeemed > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9pt", padding: "1.5mm 0", color: "#7c3aed" }}>
              <span>Points Redeemed ({sale.pointsRedeemed} pts)</span>
              <span>- Rs. {sale.pointsRedeemed?.toLocaleString()}</span>
            </div>
          )}
          {sale.taxAmount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9pt", padding: "1.5mm 0", color: "#555" }}>
              <span>Tax</span>
              <span>Rs. {sale.taxAmount?.toLocaleString()}</span>
            </div>
          )}
          <hr style={{ border: "none", borderTop: "1.5pt solid #000", margin: "3mm 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13pt", fontFamily: "'Prata', serif", fontWeight: "400" }}>
            <span>Total</span>
            <span>Rs. {sale.totalAmount?.toLocaleString()}</span>
          </div>
          {sale.paymentMethod === "cash" && sale.amountTendered > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9pt", padding: "1.5mm 0", color: "#555", marginTop: "2mm" }}>
                <span>Tendered</span>
                <span>Rs. {sale.amountTendered?.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9pt", padding: "1.5mm 0", fontWeight: "600", color: "#15803d" }}>
                <span>Change</span>
                <span>Rs. {(sale.changeAmount ?? sale.change)?.toLocaleString()}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom section: warranty terms, signatures, note & footer.
          marginTop:auto pins it to the bottom of the 297mm-tall flex column
          for the on-screen/PDF-download view (a single flat html2canvas
          capture, so this is safe — no page-fragmentation involved). Native
          browser print ("Print Bill") overrides this back to a normal flowing
          margin in @media print — Chrome's print engine doesn't actually
          repeat position:fixed content per physical page despite the spec
          allowing it, so pinning-to-bottom isn't reliably achievable there
          for a multi-page document; flowing normally avoids it being split
          across a page boundary instead. */}
      <div className="bill-signature-block" style={{ marginTop: "auto" }}>
        {/* Warranty Terms & Conditions */}
        <div style={{ background: "#f9f9f9", border: "0.5pt solid #e4e4e7", borderRadius: "2mm", padding: "2mm 3.5mm", marginBottom: "3mm", breakInside: "avoid", pageBreakInside: "avoid" }}>
          <div style={{ fontSize: "7.5pt", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.8mm" }}>Warranty Terms &amp; Conditions</div>
          <div style={{ fontSize: "6.8pt", color: "#555", lineHeight: 1.5 }}>
            Warranty replacement period: 14 days, warranty covers manufacturing defects only, no warranty for physical, liquid, electrical, or accidental damage, no warranty for software issues, OS installation, formatting, virus removal, or service/labor charges, warranty is void if the warranty sticker or serial number is removed, damaged, altered, or unreadable, all warranty claims are subject to inspection by our technicians.
          </div>
        </div>

        {/* Note */}
        {sale.note && (
          <div style={{ fontSize: "9pt", color: "#555", marginBottom: "3mm", breakInside: "avoid", pageBreakInside: "avoid" }}>
            <span style={{ fontWeight: "600" }}>Note: </span>{sale.note}
          </div>
        )}

        {/* Signatures */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10mm", marginTop: "14mm", marginBottom: "4mm", breakInside: "avoid", pageBreakInside: "avoid" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderTop: "1px dotted #000", width: "55mm", margin: "0 auto 1mm" }} />
            <div style={{ fontSize: "8pt", fontWeight: "600" }}>(Authority Signature)</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderTop: "1px dotted #000", width: "55mm", margin: "0 auto 1mm" }} />
            <div style={{ fontSize: "8pt", fontWeight: "600" }}>(Customer Signature)</div>
            <div style={{ fontSize: "7.5pt" }}>Goods received in Good Condition</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: "1pt solid #e4e4e7", paddingTop: "3mm", display: "flex", justifyContent: "space-between", alignItems: "flex-end", breakInside: "avoid", pageBreakInside: "avoid" }}>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: "10pt", fontWeight: 600, color: "#000" }}>{shop.name}</div>
            <div style={{ fontSize: "7pt", color: "#888", marginTop: "1px" }}>Thank you for your purchase!</div>
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
