import nodemailer from "nodemailer";

// Stricter than `.includes("@")` — rejects comma/semicolon-separated strings
// that nodemailer's `to` field would otherwise treat as multiple recipients,
// and rejects whitespace/control characters that could be used for header
// injection if a field is ever passed to a raw header instead of the `to` option.
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && EMAIL_RE.test(value);
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.MAIL_HOST;
  const port = Number(process.env.MAIL_PORT || 587);
  const user = process.env.MAIL_USERNAME;
  const pass = process.env.MAIL_PASSWORD;

  if (!host || !user || !pass) {
    throw new Error("Missing mail credentials. Set MAIL_HOST, MAIL_USERNAME and MAIL_PASSWORD in .env.local.");
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.MAIL_ENCRYPTION === "ssl" || port === 465,
    auth: { user, pass },
  });
  return transporter;
}

// Spam filters penalize HTML-only mail — a plain-text alternative part
// (multipart/alternative) is one of the few deliverability levers available
// without owning a domain for SPF/DKIM/DMARC.
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
      const text = label.replace(/<[^>]+>/g, "").trim();
      return text && text !== href ? `${text} (${href})` : href;
    })
    .replace(/<(br|tr|\/tr|\/table|\/div|\/p|\/h1)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function sendMail(
  to: string,
  subject: string,
  html: string,
  attachments?: { filename: string; content: string; encoding?: string }[]
) {
  const fromName = process.env.MAIL_FROM_NAME || "T&N COMPUTERS POS";
  const fromAddress = process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME;
  await getTransporter().sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject,
    html,
    text: htmlToText(html),
    attachments,
  });
}
