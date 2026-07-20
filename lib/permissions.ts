// Granular, admin-configurable permission system layered on top of the
// existing role tiers. Admin and Super Admin are always unconditionally
// allowed everywhere — this catalog only ever grants or restricts
// Manager/Cashier/Technician accounts, which an Admin configures per user
// from the Team section in Settings.
//
// `firestore.rules` mirrors the "RE" (rule-enforced) keys below via its own
// hasPerm()/hasPermDefaultTrue() helpers, reading the same `permissions` map
// this file writes — see firestore.rules for the authoritative server-side
// enforcement. Keys marked UI-only have no matching rule (see PERMISSION_CATALOG
// comments for why) and are enforced only by hiding/disabling the UI action.

export type PermissionKey =
  | "dashboard.view"
  | "sales.view"
  | "grn.create"
  | "grn.edit"
  | "grn.view"
  | "stockTransfer.create"
  | "stockTransfer.edit"
  | "stockTransfer.view"
  | "stockOut.create"
  | "stockOut.edit"
  | "stockOut.view"
  | "stockMovements.view"
  | "products.view"
  | "products.edit"
  | "products.delete"
  | "products.batch.edit"
  | "products.unit.delete"
  | "suppliers.view"
  | "suppliers.editContact"
  | "suppliers.recordPayment"
  | "suppliers.editPayment"
  | "suppliers.sendStatement"
  | "bills.view"
  | "bills.cancel"
  | "bills.edit"
  | "finance.view"
  | "finance.reviewShift"
  | "finance.addExpense"
  | "finance.deleteExpense"
  | "auditLog.view"
  | "jobs.view"
  | "jobs.edit"
  | "quotations.view"
  | "quotations.delete"
  | "brands.view"
  | "brands.delete"
  | "categories.view"
  | "categories.delete"
  | "customers.view"
  | "warranty.view";

// Roles whose permissions can be configured at all (Super Admin is never
// configurable — it's always unconditionally allowed everywhere).
export const EDITABLE_ROLES = ["Admin", "Manager", "Cashier", "Technician"] as const;
export type EditableRole = (typeof EDITABLE_ROLES)[number];

// Roles an Admin (not Super Admin) is allowed to configure — never a peer
// Admin, only the tier below. Super Admin can configure any EditableRole,
// including Admin.
const ADMIN_MANAGEABLE_ROLES: EditableRole[] = ["Manager", "Cashier", "Technician"];

export interface PermissionDef {
  key: PermissionKey;
  label: string;
  module: string;
  /** Has a matching firestore.rules enforcement point (vs. UI-only). */
  ruleEnforced: boolean;
}

// The `.view` key in each module controls whether the sidebar link and the
// page itself are visible at all — separate from the create/edit/delete
// action keys, which control what a visitor to an always-open page can do.
// Most `.view` keys are UI-only (ruleEnforced: false): their collections
// (products, customers, suppliers, sales, brands, categories, shifts) are
// each read by several *other* unrelated pages too (POS checkout alone reads
// products/customers/categories/shifts), so rule-enforcing them by module
// would break those other features for anyone using them without also
// holding that specific page's view permission — see hasPerm()'s comment in
// firestore.rules for the same reasoning applied to finance.view/
// auditLog.view, which were UI-only for this exact reason before this
// comment existed. Only genuinely single-owner collections (GRN, Stock
// Transfer, Stock Out, Stock Movements, Quotations) get a rule-enforced
// `.view` key.
export const PERMISSION_CATALOG: PermissionDef[] = [
  { key: "dashboard.view", label: "View Dashboard", module: "Dashboard", ruleEnforced: false },

  { key: "sales.view", label: "View POS / New Sale", module: "POS / Sales", ruleEnforced: false },

  { key: "grn.view", label: "View GRN", module: "GRN", ruleEnforced: true },
  { key: "grn.create", label: "Create GRN", module: "GRN", ruleEnforced: true },
  { key: "grn.edit", label: "Edit GRN", module: "GRN", ruleEnforced: true },

  { key: "stockTransfer.view", label: "View Stock Transfer", module: "Stock Transfer", ruleEnforced: true },
  { key: "stockTransfer.create", label: "Create Stock Transfer", module: "Stock Transfer", ruleEnforced: true },
  { key: "stockTransfer.edit", label: "Edit Stock Transfer", module: "Stock Transfer", ruleEnforced: true },

  { key: "stockOut.view", label: "View Stock Out", module: "Stock Out", ruleEnforced: true },
  { key: "stockOut.create", label: "Create Stock Out", module: "Stock Out", ruleEnforced: true },
  { key: "stockOut.edit", label: "Edit Stock Out", module: "Stock Out", ruleEnforced: true },

  { key: "stockMovements.view", label: "View Stock Movements", module: "Stock Movements", ruleEnforced: true },

  { key: "products.view", label: "View Products", module: "Products", ruleEnforced: false },
  { key: "products.edit", label: "Edit product details", module: "Products", ruleEnforced: true },
  { key: "products.delete", label: "Delete product", module: "Products", ruleEnforced: true },
  { key: "products.batch.edit", label: "Edit batch cost/price/qty", module: "Products", ruleEnforced: true },
  { key: "products.unit.delete", label: "Delete serial/unit", module: "Products", ruleEnforced: true },

  { key: "suppliers.view", label: "View Suppliers", module: "Suppliers", ruleEnforced: false },
  { key: "suppliers.editContact", label: "Edit supplier contact info", module: "Suppliers", ruleEnforced: true },
  { key: "suppliers.recordPayment", label: "Record supplier payment", module: "Suppliers", ruleEnforced: true },
  { key: "suppliers.editPayment", label: "Edit a recorded payment", module: "Suppliers", ruleEnforced: true },
  { key: "suppliers.sendStatement", label: "Send supplier statement email", module: "Suppliers", ruleEnforced: false },

  { key: "bills.view", label: "View Bills", module: "Bills", ruleEnforced: false },
  { key: "bills.cancel", label: "Reverse / cancel a sale", module: "Bills", ruleEnforced: true },
  { key: "bills.edit", label: "Edit bill details", module: "Bills", ruleEnforced: false },

  { key: "finance.view", label: "View Finance page", module: "Finance", ruleEnforced: false },
  { key: "finance.reviewShift", label: "Review a closed shift", module: "Finance", ruleEnforced: true },
  { key: "finance.addExpense", label: "Add an expense", module: "Finance", ruleEnforced: true },
  { key: "finance.deleteExpense", label: "Delete an expense", module: "Finance", ruleEnforced: true },

  { key: "auditLog.view", label: "View Audit Log", module: "Audit Log", ruleEnforced: false },

  { key: "jobs.view", label: "View Jobs", module: "Jobs", ruleEnforced: false },
  { key: "jobs.edit", label: "Edit job details", module: "Jobs", ruleEnforced: false },

  { key: "quotations.view", label: "View Quotations", module: "Quotations", ruleEnforced: true },
  { key: "quotations.delete", label: "Delete quotation", module: "Quotations", ruleEnforced: true },

  { key: "brands.view", label: "View Brands", module: "Brands", ruleEnforced: false },
  { key: "brands.delete", label: "Delete brand", module: "Brands", ruleEnforced: true },

  { key: "categories.view", label: "View Categories", module: "Categories", ruleEnforced: false },
  { key: "categories.delete", label: "Delete category (main + sub)", module: "Categories", ruleEnforced: true },

  { key: "customers.view", label: "View Customers", module: "Customers", ruleEnforced: false },

  { key: "warranty.view", label: "View Warranty", module: "Warranty", ruleEnforced: false },
];

// Every `.view` key defaults to true for every role — adding this feature
// shouldn't hide a single page anyone could already see; an Admin/Super
// Admin opts into hiding a module per-account from Settings > Team instead.
// Along with the two pre-existing wide-open keys, that's the full baseline —
// every other (non-view) key defaults to false for every editable role.
const VIEW_KEYS: PermissionKey[] = PERMISSION_CATALOG.map((p) => p.key).filter((k) => k.endsWith(".view"));
const DEFAULT_TRUE_KEYS: PermissionKey[] = ["products.edit", "suppliers.editContact", ...VIEW_KEYS];

function buildDefaults(trueFor: PermissionKey[]): Record<PermissionKey, boolean> {
  const result = {} as Record<PermissionKey, boolean>;
  for (const def of PERMISSION_CATALOG) {
    result[def.key] = trueFor.includes(def.key);
  }
  return result;
}

export const ROLE_DEFAULT_PERMISSIONS: Record<EditableRole, Record<PermissionKey, boolean>> = {
  // Admin's baseline is full access, same as it's always been — only an
  // explicit Super Admin override (a fully-seeded map with some keys false)
  // ever restricts an Admin.
  Admin: buildDefaults(PERMISSION_CATALOG.map((p) => p.key)),
  Manager: buildDefaults([
    ...DEFAULT_TRUE_KEYS,
    "grn.create",
    "stockTransfer.create",
    "stockOut.create",
    "finance.view",
    "finance.reviewShift",
    "finance.addExpense",
  ]),
  Cashier: buildDefaults(DEFAULT_TRUE_KEYS),
  Technician: buildDefaults(DEFAULT_TRUE_KEYS),
};

export function isEditableRole(role: string): role is EditableRole {
  return (EDITABLE_ROLES as readonly string[]).includes(role);
}

// Whether `viewerRole` is allowed to configure permissions for an account
// with `targetRole` — Super Admin can configure anyone editable (including
// Admin); Admin can only configure the tier below (never a peer Admin, never
// Super Admin). Mirrors the boundary enforced server-side in firestore.rules'
// users/{userId} update rule.
export function canManagePermissionsFor(viewerRole: string, targetRole: string): boolean {
  if (!isEditableRole(targetRole)) return false;
  if (viewerRole === "Super Admin") return true;
  if (viewerRole === "Admin") return ADMIN_MANAGEABLE_ROLES.includes(targetRole);
  return false;
}

// Super Admin never reads this — hasPermission() short-circuits to true for
// Super Admin before this is consulted. An unrecognized role (e.g. an empty
// string from a not-yet-loaded or unreadable profile) must deny by default —
// granting everything here would fail open for exactly the situation this
// function exists to guard against. Callers that legitimately want the
// Admin/Super-Admin "everything checked" default (e.g. rendering their
// read-only permission toggles in Settings) pass the literal role string
// "Admin" explicitly rather than relying on this fallback.
export function getDefaultPermissions(role: string): Record<PermissionKey, boolean> {
  if (isEditableRole(role)) return ROLE_DEFAULT_PERMISSIONS[role];
  if (role === "Admin" || role === "Super Admin") return buildDefaults(PERMISSION_CATALOG.map((p) => p.key));
  return buildDefaults([]);
}

export function hasPermission(
  profile: { role: string; permissions?: Partial<Record<PermissionKey, boolean>> } | null | undefined,
  key: PermissionKey
): boolean {
  if (!profile) return false;
  if (profile.role === "Super Admin") return true;
  if (profile.permissions && key in profile.permissions) return !!profile.permissions[key];
  return getDefaultPermissions(profile.role)[key];
}
