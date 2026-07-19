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
  | "grn.create"
  | "grn.edit"
  | "stockTransfer.create"
  | "stockTransfer.edit"
  | "stockOut.create"
  | "stockOut.edit"
  | "products.edit"
  | "products.delete"
  | "products.batch.edit"
  | "products.unit.delete"
  | "suppliers.editContact"
  | "suppliers.recordPayment"
  | "suppliers.editPayment"
  | "suppliers.sendStatement"
  | "bills.cancel"
  | "bills.edit"
  | "finance.view"
  | "finance.reviewShift"
  | "finance.addExpense"
  | "finance.deleteExpense"
  | "auditLog.view"
  | "jobs.edit"
  | "quotations.delete"
  | "brands.delete"
  | "categories.delete";

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

export const PERMISSION_CATALOG: PermissionDef[] = [
  { key: "grn.create", label: "Create GRN", module: "GRN", ruleEnforced: true },
  { key: "grn.edit", label: "Edit GRN", module: "GRN", ruleEnforced: true },

  { key: "stockTransfer.create", label: "Create Stock Transfer", module: "Stock Transfer", ruleEnforced: true },
  { key: "stockTransfer.edit", label: "Edit Stock Transfer", module: "Stock Transfer", ruleEnforced: true },

  { key: "stockOut.create", label: "Create Stock Out", module: "Stock Out", ruleEnforced: true },
  { key: "stockOut.edit", label: "Edit Stock Out", module: "Stock Out", ruleEnforced: true },

  { key: "products.edit", label: "Edit product details", module: "Products", ruleEnforced: true },
  { key: "products.delete", label: "Delete product", module: "Products", ruleEnforced: true },
  { key: "products.batch.edit", label: "Edit batch cost/price/qty", module: "Products", ruleEnforced: true },
  { key: "products.unit.delete", label: "Delete serial/unit", module: "Products", ruleEnforced: true },

  { key: "suppliers.editContact", label: "Edit supplier contact info", module: "Suppliers", ruleEnforced: true },
  { key: "suppliers.recordPayment", label: "Record supplier payment", module: "Suppliers", ruleEnforced: true },
  { key: "suppliers.editPayment", label: "Edit a recorded payment", module: "Suppliers", ruleEnforced: true },
  { key: "suppliers.sendStatement", label: "Send supplier statement email", module: "Suppliers", ruleEnforced: false },

  { key: "bills.cancel", label: "Reverse / cancel a sale", module: "Bills", ruleEnforced: true },
  { key: "bills.edit", label: "Edit bill details", module: "Bills", ruleEnforced: false },

  { key: "finance.view", label: "View Finance page", module: "Finance", ruleEnforced: false },
  { key: "finance.reviewShift", label: "Review a closed shift", module: "Finance", ruleEnforced: true },
  { key: "finance.addExpense", label: "Add an expense", module: "Finance", ruleEnforced: true },
  { key: "finance.deleteExpense", label: "Delete an expense", module: "Finance", ruleEnforced: true },

  { key: "auditLog.view", label: "View Audit Log", module: "Audit Log", ruleEnforced: false },

  { key: "jobs.edit", label: "Edit job details", module: "Jobs", ruleEnforced: false },

  { key: "quotations.delete", label: "Delete quotation", module: "Quotations", ruleEnforced: true },

  { key: "brands.delete", label: "Delete brand", module: "Brands", ruleEnforced: true },

  { key: "categories.delete", label: "Delete category (main + sub)", module: "Categories", ruleEnforced: true },
];

// The two keys whose baseline preserves today's wide-open behavior — every
// other key defaults to false for every editable role.
const DEFAULT_TRUE_KEYS: PermissionKey[] = ["products.edit", "suppliers.editContact"];

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
// Super Admin before this is consulted.
export function getDefaultPermissions(role: string): Record<PermissionKey, boolean> {
  if (isEditableRole(role)) return ROLE_DEFAULT_PERMISSIONS[role];
  return buildDefaults(PERMISSION_CATALOG.map((p) => p.key));
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
