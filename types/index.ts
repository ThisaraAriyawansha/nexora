export interface Brand {
  id: string;
  name: string;
  description?: string;
  createdAt?: any;
}

export interface MainCategory {
  id: string;
  name: string;
  description?: string;
  createdAt?: any;
}

export interface SubCategory {
  id: string;
  name: string;
  mainCategoryId: string;
  mainCategoryName?: string;
  description?: string;
  createdAt?: any;
}

export type StockLocation = "stores" | "showroom";

export interface ProductBatch {
  id: string;
  costPrice: number;
  sellingPrice?: number;
  totalQty: number;
  remainingQty: number;
  status: "active" | "depleted";
  receivedAt?: any;
  note?: string;
  location: StockLocation;
  sourceBatchId?: string | null;
}

export interface Product {
  id: string;
  name: string;
  brandId: string;
  brandName?: string;
  mainCategoryId: string;
  mainCategoryName?: string;
  subCategoryId: string;
  subCategoryName?: string;
  sku: string;
  sellingPrice: number;
  totalStock: number;
  storesStock: number;
  showroomStock: number;
  lowStockAlert: number;
  description?: string;
  warrantyMonths?: number;
  trackSerial?: boolean;
  active: boolean;
  lowStockAlerted?: boolean;
  createdAt?: any;
}

export interface ProductUnit {
  id: string;
  serialNumber: string;
  batchId: string;
  costPrice: number;
  status: "in_stock" | "sold" | "issued";
  location: StockLocation;
  saleId?: string | null;
  soldAt?: any;
  stockOutId?: string | null;
  issuedAt?: any;
  createdAt?: any;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  loyaltyPoints: number;
  createdAt?: any;
}

export interface ShopSettings {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notifyEmails?: string[];
  updatedAt?: any;
}

export type SupplierPaymentStatus = "paid" | "partial" | "outstanding";

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  totalPayable: number;
  amountPaid: number;
  balance: number;
  paymentStatus: SupplierPaymentStatus;
  lastPaymentAt?: any;
  lastStatementSentAt?: any;
  createdAt?: any;
}

export type SupplierPaymentMethod = "cash" | "bank_transfer" | "cheque" | "other";

export interface SupplierPayment {
  id: string;
  paymentNo: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  method: SupplierPaymentMethod;
  reference?: string;
  note?: string;
  balanceBefore: number;
  balanceAfter: number;
  paidById: string;
  paidByName: string;
  createdAt?: any;
}

export interface SaleItemUnit {
  unitId: string;
  serialNumber: string;
  batchId: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  sku: string;
  batchId?: string | null;
  qty: number;
  unitPrice: number;
  costPrice: number;
  discount: number;
  lineTotal: number;
  warrantyMonths?: number;
  units?: SaleItemUnit[];
  batchAllocations?: { batchId: string; qty: number }[];
}

export type SaleStatus = "cancelled";

export interface Sale {
  id: string;
  invoiceNo: string;
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  cashierId: string;
  cashierName: string;
  items: SaleItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: "cash" | "card" | "transfer";
  paymentStatus: "paid" | "partial" | "pending";
  amountTendered?: number;
  changeAmount?: number;
  pointsRedeemed?: number;
  note?: string;
  shiftId?: string | null;
  shiftNo?: string;
  // Set only once a sale is reversed via cancelSale() — absent on a normal sale.
  status?: SaleStatus;
  cancelledAt?: any;
  cancelledById?: string;
  cancelledByName?: string;
  cancelReason?: string;
  createdAt?: any;
  updatedAt?: any;
}

export type ShiftStatus = "open" | "closed";
export type ShiftReviewStatus = "pending" | "approved" | "flagged";

export interface Shift {
  id: string;
  shiftNo: string;
  cashierId: string;
  cashierName: string;
  status: ShiftStatus;
  openingFloat: number;
  openedAt: any;
  openNote?: string;
  cashSalesTotal: number;
  cardSalesTotal: number;
  transferSalesTotal: number;
  salesCount: number;
  closedAt?: any;
  expectedCash?: number;
  countedCash?: number;
  variance?: number;
  closeNote?: string;
  reviewStatus?: ShiftReviewStatus;
  reviewedAt?: any;
  reviewedById?: string;
  reviewedByName?: string;
  reviewNote?: string;
}

export type ExpenseCategory = "rent" | "utilities" | "salaries" | "maintenance" | "marketing" | "other";

export interface Expense {
  id: string;
  expenseNo: string;
  category: ExpenseCategory;
  amount: number;
  note?: string;
  paidById: string;
  paidByName: string;
  createdAt?: any;
}

export interface QuotationItem {
  productId?: string | null;
  productName: string;
  sku?: string;
  qty: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

export interface Quotation {
  id: string;
  quotationNo: string;
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  preparedById: string;
  preparedByName: string;
  items: QuotationItem[];
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  validUntil: any;
  status: "sent" | "accepted" | "rejected" | "expired" | "converted";
  note?: string;
  createdAt?: any;
}

export interface Warranty {
  id: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  saleId: string;
  serialNumber?: string;
  warrantyMonths: number;
  startDate: any;
  endDate: any;
  status: "active" | "expired" | "claimed";
  claimNote?: string;
  claimedAt?: any;
  createdAt?: any;
}

export type StockMovementReason = "job" | "sale" | "other";

export interface StockMovement {
  id: string;
  productId: string;
  type: "in" | "out" | "adjustment" | "transfer";
  qty: number;
  referenceId?: string;
  referenceType?: string;
  note?: string;
  performedBy: string;
  performedByName?: string;
  location?: StockLocation;
  fromLocation?: StockLocation;
  toLocation?: StockLocation;
  recipient?: string;
  reason?: StockMovementReason;
  reasonDetail?: string;
  jobId?: string | null;
  jobNo?: string | null;
  supplierName?: string;
  createdAt?: any;
}

export interface Grn {
  id: string;
  grnNo: string;
  supplierId?: string | null;
  supplierName?: string;
  totalCost: number;
  receivedById: string;
  receivedByName: string;
  note?: string;
  createdAt?: any;
}

export interface GrnItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  qty: number;
  costPrice: number;
  sellingPrice?: number | null;
  serials?: string[];
  batchId: string;
}

export interface StockTransfer {
  id: string;
  transferNo: string;
  transferredById: string;
  transferredByName: string;
  note?: string;
  createdAt?: any;
}

export interface StockTransferItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  qty: number;
  serialNumbers?: string[];
  sourceBatchIds?: string[];
  newBatchIds?: string[];
}

export interface StockOut {
  id: string;
  stockOutNo: string;
  location: StockLocation;
  issuedById: string;
  issuedByName: string;
  recipient: string;
  reason: StockMovementReason;
  reasonDetail?: string;
  jobId?: string | null;
  jobNo?: string | null;
  note?: string;
  createdAt?: any;
}

export interface StockOutItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  qty: number;
  serialNumbers?: string[];
  costPrice: number;
}

export interface CartItem extends SaleItem {
  tempId: string;
}

export type JobStatus = "pending" | "ongoing" | "done" | "unrepairable";

export interface JobStatusEntry {
  id: string;
  status: JobStatus;
  note?: string;
  repairCost?: number | null;
  updatedById: string;
  updatedByName: string;
  createdAt?: any;
}

export interface Job {
  id: string;
  jobNo: string;
  customerId?: string | null;
  customerName: string;
  customerCompany?: string;
  customerAddress?: string;
  customerCity?: string;
  customerPhone: string;
  customerEmail?: string;
  deviceType: string;
  deviceTypeOther?: string;
  brand?: string;
  model?: string;
  serialNo?: string;
  color?: string;
  faultDescription: string;
  accessories: string[];
  accessoriesOther?: string;
  physicalCondition: string[];
  specialNotes?: string;
  receivedById: string;
  receivedByName: string;
  assignedTechnicianId?: string | null;
  assignedTechnicianName?: string;
  estimatedCost: number;
  advancePaid: number;
  expectedDeliveryDate?: any;
  status: JobStatus;
  repairCost?: number | null;
  dateReturned?: any;
  createdAt?: any;
}

export interface UserProfile {
  uid: string;
  email?: string;
  displayName: string;
  phone?: string;
  role: string;
  status?: "active" | "inactive";
  // Per-action permission overrides — only meaningful when role is
  // Manager/Cashier/Technician. Admin/Super Admin are always unconditionally
  // allowed and never read this. See lib/permissions.ts.
  permissions?: Partial<Record<import("@/lib/permissions").PermissionKey, boolean>>;
  createdAt?: any;
  updatedAt?: any;
}

export interface AuditLogChange {
  field: string;
  before: any;
  after: any;
}

export interface AuditLog {
  id: string;
  collectionName: string;
  docId: string;
  label: string;
  changes: AuditLogChange[];
  performedById: string;
  performedByName: string;
  createdAt?: any;
}
