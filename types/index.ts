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

export interface ProductBatch {
  id: string;
  costPrice: number;
  sellingPrice?: number;
  totalQty: number;
  remainingQty: number;
  status: "active" | "depleted";
  receivedAt?: any;
  note?: string;
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
  lowStockAlert: number;
  description?: string;
  warrantyMonths?: number;
  trackSerial?: boolean;
  active: boolean;
  createdAt?: any;
}

export interface ProductUnit {
  id: string;
  serialNumber: string;
  batchId: string;
  costPrice: number;
  status: "in_stock" | "sold";
  saleId?: string | null;
  soldAt?: any;
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
}

export interface Sale {
  id: string;
  invoiceNo: string;
  customerId?: string | null;
  customerName?: string;
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

export interface StockMovement {
  id: string;
  productId: string;
  type: "in" | "out" | "adjustment";
  qty: number;
  referenceId?: string;
  referenceType?: string;
  note?: string;
  performedBy: string;
  createdAt?: any;
}

export interface CartItem extends SaleItem {
  tempId: string;
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
