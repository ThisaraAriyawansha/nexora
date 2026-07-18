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

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
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
  note?: string;
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
  createdAt?: any;
  updatedAt?: any;
}
