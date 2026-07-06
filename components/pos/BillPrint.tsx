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
      <div className="bill-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8mm", paddingBottom: "6mm", borderBottom: "2px solid #000" }}>
        <div>
          <div className="bill-title" style={{ fontFamily: "'Poppins', sans-serif", fontSize: "32pt", letterSpacing: "-0.5px", lineHeight: 1 }}>{shop.name}</div>
          {shop.address && <div style={{ fontSize: "9pt", color: "#555", marginTop: "3px" }}>{shop.address}</div>}
          <div style={{ fontSize: "8pt", color: "#888", marginTop: "2px" }}>
            {shop.phone && <>Tel: {shop.phone}</>}
            {shop.phone && shop.email && " | "}
            {shop.email}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "9pt", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>Invoice</div>
          <div style={{ fontSize: "16pt", fontFamily: "'Prata', serif", fontWeight: "400" }}>{sale.invoiceNo}</div>
          <div style={{ fontSize: "8pt", color: "#666", marginTop: "4px" }}>{dateStr}</div>
          <div style={{ fontSize: "8pt", color: "#666" }}>{timeStr}</div>
        </div>
      </div>

      {/* Customer & Cashier info */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8mm", marginBottom: "8mm" }}>
        <div>
          <div style={{ fontSize: "8pt", textTransform: "uppercase", letterSpacing: "0.08em", color: "#888", marginBottom: "3px" }}>Bill To</div>
          <div style={{ fontSize: "10pt", fontWeight: "600" }}>{sale.customerName || "Walk-in Customer"}</div>
          {sale.customerPhone && <div style={{ fontSize: "9pt", color: "#555" }}>{sale.customerPhone}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          {sale.cashierName && (
            <>
              <div style={{ fontSize: "8pt", textTransform: "uppercase", letterSpacing: "0.08em", color: "#888", marginBottom: "3px" }}>Served By</div>
              <div style={{ fontSize: "10pt", fontWeight: "600" }}>{sale.cashierName?.includes("@") ? "Cashier" : sale.cashierName}</div>
            </>
          )}
          <div style={{ fontSize: "9pt", color: "#555", textTransform: "capitalize" }}>Payment: {sale.paymentMethod}</div>
        </div>
      </div>

      {/* Items table */}
      <table className="bill-table" style={{ width: "100%", borderCollapse: "collapse", marginBottom: "6mm" }}>
        <thead>
          <tr>
            <th style={{ borderBottom: "1.5pt solid #000", padding: "3mm 2mm", textAlign: "left", fontSize: "8pt", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>#</th>
            <th style={{ borderBottom: "1.5pt solid #000", padding: "3mm 2mm", textAlign: "left", fontSize: "8pt", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>Description</th>
            <th style={{ borderBottom: "1.5pt solid #000", padding: "3mm 2mm", textAlign: "center", fontSize: "8pt", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>Qty</th>
            <th style={{ borderBottom: "1.5pt solid #000", padding: "3mm 2mm", textAlign: "right", fontSize: "8pt", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>Unit Price</th>
            <th style={{ borderBottom: "1.5pt solid #000", padding: "3mm 2mm", textAlign: "right", fontSize: "8pt", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>Disc.</th>
            <th style={{ borderBottom: "1.5pt solid #000", padding: "3mm 2mm", textAlign: "right", fontSize: "8pt", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.items?.map((item: any, i: number) => (
            <tr key={i}>
              <td style={{ padding: "2.5mm 2mm", borderBottom: "0.5pt solid #e4e4e7", fontSize: "9pt", color: "#555" }}>{i + 1}</td>
              <td style={{ padding: "2.5mm 2mm", borderBottom: "0.5pt solid #e4e4e7", fontSize: "10pt" }}>
                <div style={{ fontWeight: "500" }}>{item.productName}</div>
                <div style={{ fontSize: "8pt", color: "#888" }}>SKU: {item.sku}</div>
                {item.units?.length > 0 && (
                  <div style={{ fontSize: "8pt", color: "#888" }}>Serial: {item.units.map((u: any) => u.serialNumber).join(", ")}</div>
                )}
                {item.warrantyMonths > 0 && (
                  <div style={{ fontSize: "8pt", color: "#555" }}>Warranty: {item.warrantyMonths} month{item.warrantyMonths > 1 ? "s" : ""}</div>
                )}
              </td>
              <td style={{ padding: "2.5mm 2mm", borderBottom: "0.5pt solid #e4e4e7", fontSize: "10pt", textAlign: "center" }}>{item.qty}</td>
              <td style={{ padding: "2.5mm 2mm", borderBottom: "0.5pt solid #e4e4e7", fontSize: "10pt", textAlign: "right" }}>Rs. {item.unitPrice?.toLocaleString()}</td>
              <td style={{ padding: "2.5mm 2mm", borderBottom: "0.5pt solid #e4e4e7", fontSize: "10pt", textAlign: "right", color: item.discount > 0 ? "#dc2626" : "#aaa" }}>
                {item.discount > 0 ? `Rs. ${item.discount.toLocaleString()}` : "—"}
              </td>
              <td style={{ padding: "2.5mm 2mm", borderBottom: "0.5pt solid #e4e4e7", fontSize: "10pt", textAlign: "right", fontWeight: "600" }}>Rs. {item.lineTotal?.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8mm" }}>
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

      {/* Bottom section: warranty notice, note & footer pinned to page bottom */}
      <div style={{ marginTop: "auto" }}>
        {/* Warranty notice */}
        {sale.items?.some((i: any) => i.warrantyMonths > 0) && (
          <div style={{ background: "#f9f9f9", border: "0.5pt solid #e4e4e7", borderRadius: "3mm", padding: "4mm", marginBottom: "6mm" }}>
            <div style={{ fontSize: "8pt", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2mm" }}>Warranty Notice</div>
            <div style={{ fontSize: "8pt", color: "#555" }}>
              Please keep this invoice as proof of warranty. Warranty covers manufacturer defects only.
              Visit our store with this invoice for warranty claims.
            </div>
          </div>
        )}

        {/* Note */}
        {sale.note && (
          <div style={{ fontSize: "9pt", color: "#555", marginBottom: "6mm" }}>
            <span style={{ fontWeight: "600" }}>Note: </span>{sale.note}
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: "1pt solid #e4e4e7", paddingTop: "3mm", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
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
