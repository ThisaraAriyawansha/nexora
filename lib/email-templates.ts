function emailFooter(year: number) {
  return `
    <div style="padding:16px 24px;border-top:1px solid #eee;font-family:Arial,Helvetica,sans-serif">
      <p style="color:#aaa;font-size:11px;margin:0 0 4px">© ${year} Nexora POS - automated message, please don't reply.</p>
      <p style="color:#ccc;font-size:11px;margin:0">Design &amp; Developed by plexCode</p>
    </div>
  `;
}

function emailShell(body: string, year: number) {
  return `
    <div style="background:#f4f4f5;padding:32px 16px;font-family:Georgia,'Times New Roman',serif">
      <div style="max-width:420px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
        <div style="background:#000;padding:20px 24px">
          <span style="font-size:22px;color:#fff;letter-spacing:0.5px;font-style:italic">Nexora</span>
        </div>
        <div style="padding:28px 24px;font-family:Arial,Helvetica,sans-serif;color:#111">
          ${body}
        </div>
        ${emailFooter(year)}
      </div>
    </div>
  `;
}

export function changeEmailTemplate(newEmail: string, link: string, currentEmail?: string) {
  const year = new Date().getFullYear();
  return emailShell(
    `
      <h1 style="font-size:16px;margin:0 0 12px">Confirm your email change</h1>
      <p style="margin:0 0 8px;font-size:14px;line-height:1.5">
        ${currentEmail ? `You asked to change the email on your Nexora POS account from <strong>${currentEmail}</strong> to <strong>${newEmail}</strong>.` : `Confirm <strong>${newEmail}</strong> as your new Nexora POS email.`}
      </p>
      <p style="color:#999;font-size:12px;margin:0 0 20px">This link expires in 1 hour for your security.</p>
      <a href="${link}" style="background:#000;color:#fff;font-size:13px;padding:10px 22px;text-decoration:none;border-radius:6px;display:inline-block">
        Confirm Email
      </a>
      <p style="color:#999;font-size:12px;margin:20px 0 0">
        If you didn't request this, you can ignore this email - your address won't be changed.
      </p>
      <p style="color:#bbb;font-size:11px;margin:16px 0 0;word-break:break-all">
        Button not working? Paste this link into your browser:<br />
        <a href="${link}" style="color:#999">${link}</a>
      </p>
    `,
    year
  );
}

// Job update emails are sent on behalf of the shop running Nexora, not the
// Nexora product itself, so they get their own shell branded with the
// shop's own name/contact details (from ShopSettings) instead of "Nexora".
function shopEmailFooter(shop: { name: string; phone?: string; email?: string }, year: number) {
  // Explicit tel:/mailto: links styled to match the surrounding text — plain
  // text phone numbers/emails get auto-linked by Gmail et al. into their own
  // blue, underlined style that ignores the muted look the rest of the
  // footer uses, which is what made this look inconsistent before.
  const linkStyle = "color:#999;text-decoration:none";
  const parts = [
    shop.phone ? `<a href="tel:${shop.phone}" style="${linkStyle}">${shop.phone}</a>` : "",
    shop.email ? `<a href="mailto:${shop.email}" style="${linkStyle}">${shop.email}</a>` : "",
  ].filter(Boolean);
  const contact = parts.join('<span style="color:#ddd;padding:0 6px">&middot;</span>');

  return `
    <div style="padding:18px 24px;border-top:1px solid #f0f0f0;font-family:Arial,Helvetica,sans-serif;text-align:center">
      ${contact ? `<p style="font-size:11.5px;margin:0 0 6px">${contact}</p>` : ""}
      <p style="color:#ccc;font-size:10.5px;margin:0">© ${year} ${shop.name}</p>
    </div>
  `;
}

function shopEmailShell(body: string, shop: { name: string; phone?: string; email?: string }, year: number) {
  return `
    <div style="background:#f4f4f5;padding:32px 16px;font-family:Georgia,'Times New Roman',serif">
      <div style="max-width:420px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
        <div style="background:#000;padding:20px 24px">
          <span style="font-size:22px;color:#fff;letter-spacing:0.5px;font-style:italic">${shop.name}</span>
        </div>
        <div style="padding:28px 24px;font-family:Arial,Helvetica,sans-serif;color:#111">
          ${body}
        </div>
        ${shopEmailFooter(shop, year)}
      </div>
    </div>
  `;
}

export function jobUpdateTemplate(params: {
  customerName: string;
  jobNo: string;
  statusLabel: string;
  device?: string;
  note?: string;
  repairCost?: number | null;
  isNew: boolean;
  shop: { name: string; phone?: string; email?: string };
}) {
  const { customerName, jobNo, statusLabel, device, note, repairCost, isNew, shop } = params;
  const year = new Date().getFullYear();
  return shopEmailShell(
    `
      <h1 style="font-size:16px;margin:0 0 12px">
        ${isNew ? "We've received your device for service" : "Your job status has been updated"}
      </h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.5">
        Hi ${customerName}, ${isNew
          ? `we've logged your ${device || "device"} for service with ${shop.name}. You can quote the job number below when following up with us.`
          : `here's the latest update on your ${device || "device"} repair at ${shop.name}.`}
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 16px">
        <tr>
          <td style="padding:6px 0;color:#999;font-size:12px;width:110px">Job No.</td>
          <td style="padding:6px 0;font-size:13px;font-weight:bold">${jobNo}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#999;font-size:12px">Status</td>
          <td style="padding:6px 0;font-size:13px;font-weight:bold">${statusLabel}</td>
        </tr>
        ${repairCost != null ? `
        <tr>
          <td style="padding:6px 0;color:#999;font-size:12px">Repair Cost</td>
          <td style="padding:6px 0;font-size:13px">Rs. ${Number(repairCost).toLocaleString()}</td>
        </tr>` : ""}
      </table>
      ${note ? `<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#333">${note}</p>` : ""}
      ${shop.phone ? `
      <a href="tel:${shop.phone}" style="background:#000;color:#fff;font-size:13px;padding:10px 22px;text-decoration:none;border-radius:6px;display:inline-block;margin-top:8px">
        Call ${shop.name} · ${shop.phone}
      </a>` : ""}
      <p style="color:#999;font-size:12px;margin:16px 0 0">
        Please bring this job number when collecting your device. Contact us if you have any questions.
      </p>
    `,
    shop,
    year
  );
}

const WARRANTY_TERMS_TEXT =
  "Warranty replacement period: 14 days, warranty covers manufacturing defects only, no warranty for physical, liquid, electrical, or accidental damage, no warranty for software issues, OS installation, formatting, virus removal, or service/labor charges, warranty is void if the warranty sticker or serial number is removed, damaged, altered, or unreadable, all warranty claims are subject to inspection by our technicians.";

export function billEmailTemplate(params: {
  customerName: string;
  invoiceNo: string;
  items: { productName: string; qty: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: string;
  shop: { name: string; phone?: string; email?: string };
}) {
  const { customerName, invoiceNo, items, subtotal, discountAmount, totalAmount, paymentMethod, shop } = params;
  const year = new Date().getFullYear();
  return shopEmailShell(
    `
      <h1 style="font-size:16px;margin:0 0 12px">Thank you for your purchase!</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.5">
        Hi ${customerName}, here's your receipt from ${shop.name}. The full invoice is also attached as a PDF.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 12px">
        <tr>
          <td style="padding:6px 0;color:#999;font-size:12px;width:110px">Invoice No.</td>
          <td style="padding:6px 0;font-size:13px;font-weight:bold">${invoiceNo}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#999;font-size:12px">Payment</td>
          <td style="padding:6px 0;font-size:13px;text-transform:capitalize">${paymentMethod}</td>
        </tr>
      </table>
      <table style="width:100%;border-collapse:collapse;margin:0 0 12px;border-top:1px solid #eee">
        ${items.map((i) => `
        <tr>
          <td style="padding:6px 0;font-size:12px;border-bottom:1px solid #f4f4f5">${i.productName} <span style="color:#999">x${i.qty}</span></td>
          <td style="padding:6px 0;font-size:12px;text-align:right;border-bottom:1px solid #f4f4f5;white-space:nowrap">Rs. ${i.lineTotal.toLocaleString()}</td>
        </tr>`).join("")}
      </table>
      <table style="width:100%;border-collapse:collapse;margin:0 0 16px">
        <tr>
          <td style="padding:3px 0;font-size:12px;color:#999">Subtotal</td>
          <td style="padding:3px 0;font-size:12px;text-align:right">Rs. ${subtotal.toLocaleString()}</td>
        </tr>
        ${discountAmount > 0 ? `
        <tr>
          <td style="padding:3px 0;font-size:12px;color:#999">Discount</td>
          <td style="padding:3px 0;font-size:12px;text-align:right;color:#dc2626">- Rs. ${discountAmount.toLocaleString()}</td>
        </tr>` : ""}
        <tr>
          <td style="padding:6px 0;font-size:14px;font-weight:bold;border-top:1px solid #eee">Total</td>
          <td style="padding:6px 0;font-size:14px;font-weight:bold;text-align:right;border-top:1px solid #eee">Rs. ${totalAmount.toLocaleString()}</td>
        </tr>
      </table>
      <div style="background:#f9f9f9;border-radius:6px;padding:12px 14px;margin:0 0 4px">
        <p style="font-size:10.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px;color:#555">Warranty Terms &amp; Conditions</p>
        <p style="font-size:10.5px;color:#888;line-height:1.5;margin:0">${WARRANTY_TERMS_TEXT}</p>
      </div>
    `,
    shop,
    year
  );
}

export function lowStockAlertTemplate(params: {
  items: { productName: string; sku: string; totalStock: number; lowStockAlert: number }[];
  shop: { name: string; phone?: string; email?: string };
}) {
  const { items, shop } = params;
  const year = new Date().getFullYear();
  return shopEmailShell(
    `
      <h1 style="font-size:16px;margin:0 0 12px">Low stock alert</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.5">
        ${items.length === 1 ? "This item has" : `These ${items.length} items have`} dropped to or below its restock threshold at ${shop.name}.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 4px">
        <tr>
          <td style="padding:6px 0;font-size:10.5px;text-transform:uppercase;letter-spacing:0.05em;color:#999;border-bottom:1px solid #eee">Product</td>
          <td style="padding:6px 0;font-size:10.5px;text-transform:uppercase;letter-spacing:0.05em;color:#999;border-bottom:1px solid #eee;text-align:right">In Stock</td>
          <td style="padding:6px 0;font-size:10.5px;text-transform:uppercase;letter-spacing:0.05em;color:#999;border-bottom:1px solid #eee;text-align:right">Threshold</td>
        </tr>
        ${items.map((i) => `
        <tr>
          <td style="padding:8px 0;font-size:13px;border-bottom:1px solid #f4f4f5">${i.productName}${i.sku ? ` <span style="color:#999;font-size:11px">(${i.sku})</span>` : ""}</td>
          <td style="padding:8px 0;font-size:13px;text-align:right;border-bottom:1px solid #f4f4f5;font-weight:bold;color:${i.totalStock <= 0 ? "#dc2626" : "#111"}">${i.totalStock}</td>
          <td style="padding:8px 0;font-size:13px;text-align:right;border-bottom:1px solid #f4f4f5;color:#999">${i.lowStockAlert}</td>
        </tr>`).join("")}
      </table>
      <p style="color:#999;font-size:12px;margin:16px 0 0">
        You'll get another alert for each item once it's restocked and dips low again.
      </p>
    `,
    shop,
    year
  );
}

// Sent BY the store TO a supplier — the store owes the supplier (Total
// Payable comes from GRNs), never the other way round, so this is worded as
// a neutral account statement/confirmation, not a debt-collection "reminder"
// aimed at the supplier.
export function supplierAccountStatementTemplate(params: {
  supplierName: string;
  totalPayable: number;
  amountPaid: number;
  balance: number;
  shop: { name: string; phone?: string; email?: string };
}) {
  const { supplierName, totalPayable, amountPaid, balance, shop } = params;
  const year = new Date().getFullYear();
  return shopEmailShell(
    `
      <h1 style="font-size:16px;margin:0 0 12px">Account Statement</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.5">
        Hi ${supplierName}, here's a summary of our current account with you at ${shop.name}.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 16px">
        <tr>
          <td style="padding:6px 0;color:#999;font-size:12px;width:140px">Total Purchased</td>
          <td style="padding:6px 0;font-size:13px">Rs. ${totalPayable.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#999;font-size:12px">Amount Paid</td>
          <td style="padding:6px 0;font-size:13px">Rs. ${amountPaid.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#999;font-size:12px">Balance We Owe You</td>
          <td style="padding:6px 0;font-size:14px;font-weight:bold;color:#111">Rs. ${balance.toLocaleString()}</td>
        </tr>
      </table>
      ${shop.phone ? `
      <a href="tel:${shop.phone}" style="background:#000;color:#fff;font-size:13px;padding:10px 22px;text-decoration:none;border-radius:6px;display:inline-block;margin-top:8px">
        Call ${shop.name} · ${shop.phone}
      </a>` : ""}
      <p style="color:#999;font-size:12px;margin:16px 0 0">
        Please let us know if these figures don't match your own records.
      </p>
    `,
    shop,
    year
  );
}

export function passwordResetOtpTemplate(otp: string) {
  const year = new Date().getFullYear();
  return emailShell(
    `
      <h1 style="font-size:16px;margin:0 0 12px">Reset your password</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.5">
        Use the code below to reset your Nexora POS password. It expires in 10 minutes.
      </p>
      <p style="background:#f4f4f5;border-radius:6px;padding:16px;text-align:center;font-size:28px;letter-spacing:8px;font-weight:bold;color:#111;margin:0 0 20px">
        ${otp}
      </p>
      <p style="color:#999;font-size:12px;margin:0">
        If you didn't request this, you can ignore this email - your password won't change.
      </p>
    `,
    year
  );
}
