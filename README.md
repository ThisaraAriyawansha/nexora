# Nexora POS

A modern point-of-sale and computer shop management system built for **T&N COMPUTERS** — covering sales, inventory, repairs, suppliers, finance, payroll, and business reporting in one app.

## Tech stack

- **Framework:** [Next.js 14](https://nextjs.org/) (App Router) + React 18 + TypeScript
- **Styling:** Tailwind CSS
- **Backend/Data:** Firebase (Auth, Firestore, App Check) on the client, `firebase-admin` for privileged server-side operations (API routes)
- **Email:** Nodemailer (SMTP) for password resets, invoices, payslips, low-stock alerts, job notifications
- **PDF/Print:** `jspdf`, `html2canvas`, `react-to-print` for bills, quotations, and job sheets
- **Bot protection:** Cloudflare Turnstile (login/reset forms) + Firebase App Check (reCAPTCHA v3)

## Core modules

| Module | Description |
|---|---|
| **Dashboard** | At-a-glance business overview |
| **POS / Sales** | New sale checkout, cart, split payments (cash/card/transfer/KokoPay), loyalty points |
| **Bills** | Invoice history, cancel/reverse sales, resend by email |
| **Quotations** | Create, send, and convert quotations to sales |
| **Jobs** | Repair job intake, technician assignment, status tracking, paid/free service lines, warranty linkage |
| **Products** | Catalog with brands/categories, batches, serials, per-location stock (stores/showroom), low-stock alerts |
| **GRN** | Goods Received Notes — receive stock from suppliers |
| **Stock Transfer** | Move stock between stores and showroom |
| **Stock Out** | Issue stock out (e.g. for a job, write-off) |
| **Stock Movements** | Full audit trail of stock in/out/adjustment/transfer |
| **Suppliers** | Supplier accounts, payables, payment recording, account statements |
| **Finance** | Cashier shifts (open/close/review), expenses, cash reconciliation |
| **Salary** | Employee payroll — monthly, commission, or hybrid, linked to sales/jobs, payslip emails |
| **Brands / Categories** | Product taxonomy management |
| **Customers** | Customer records and loyalty points |
| **Warranty** | Warranty tracking and claims |
| **Audit Log** | Change history across the system |
| **Settings** | Shop profile, team & role permissions, notification emails |

## Roles & permissions

Roles: **Super Admin, Admin, Manager, Cashier, Technician, Staff.**

Super Admin always has full, unconditional access. Admin has full access by default unless a Super Admin restricts it. Manager/Cashier/Technician/Staff have a sensible default permission set that an Admin/Super Admin can fine-tune per user from **Settings → Team**, down to individual actions (e.g. "create GRN" vs "edit GRN"). Permission keys are defined in [`lib/permissions.ts`](lib/permissions.ts) and the sensitive ones are mirrored/enforced server-side in [`firestore.rules`](firestore.rules).

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your own values:

```bash
cp .env.local.example .env.local
```

You'll need:

- **Firebase client config** — Firebase Console → Project Settings → Your apps
- **Firebase Admin credentials** — Firebase Console → Project Settings → Service Accounts → Generate new private key
- **Firebase App Check (reCAPTCHA v3)** — Firebase Console → App Check → register a web app, plus a matching reCAPTCHA v3 site key from Google Cloud Console. Required for App Check enforcement to work; harmless if left unset in development.
- **Cloudflare Turnstile** — site + secret key, used as a bot check on the login/reset-password forms
- **SMTP credentials** — used to send password reset, bill, quotation, payslip, and low-stock alert emails

### 3. Deploy Firestore rules

The authoritative server-side authorization lives in [`firestore.rules`](firestore.rules) and mirrors the permission catalog in `lib/permissions.ts`. Deploy it with the Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Other scripts

```bash
npm run build   # production build
npm run start   # run the production build
```

## Project structure

```
app/
  (app)/            # authenticated pages (dashboard, sales, products, jobs, finance, ...)
  api/               # server-side route handlers (email sending, auth, password reset, ...)
  auth/login/        # login page
components/
  layout/            # app shell (Sidebar, AppLayout)
  pos/               # print templates (Bill, Job, Quotation)
  ui/                # shared UI primitives
hooks/               # useAuth, useShopName
lib/                 # firebase client/admin, firestore helpers, permissions, mailer, pdf/csv export, audit log
types/               # shared TypeScript domain types (Product, Sale, Job, Shift, ...)
firestore.rules       # Firestore security rules (server-side permission enforcement)
```

## Security notes

- Firebase App Check + Turnstile are layered on top of Firebase Auth to reject direct API abuse and bot traffic on public forms.
- Sensitive actions (deleting a product/batch, editing supplier payments, issuing salary, cancelling a sale, etc.) are enforced both in the UI (via `can()` from `useAuth`) and in `firestore.rules`, not just hidden client-side.
- Every meaningful create/update/delete is written to the Audit Log (`lib/audit.ts`) for traceability.
