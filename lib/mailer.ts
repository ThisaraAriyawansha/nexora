import nodemailer from "nodemailer";

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

export async function sendMail(to: string, subject: string, html: string) {
  const fromName = process.env.MAIL_FROM_NAME || "Nexora POS";
  const fromAddress = process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME;
  await getTransporter().sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject,
    html,
  });
}
