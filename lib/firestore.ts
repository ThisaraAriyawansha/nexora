import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, orderBy,
  serverTimestamp, FieldValue, increment,
  runTransaction, Timestamp, writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

// ─── BRANDS ───────────────────────────────────────────────────────────────────

export async function getBrands() {
  const snap = await getDocs(query(collection(db, "brands"), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addBrand(data: { name: string; description?: string }) {
  return addDoc(collection(db, "brands"), { ...data, createdAt: serverTimestamp() });
}

export async function updateBrand(id: string, data: Partial<{ name: string; description: string }>) {
  return updateDoc(doc(db, "brands", id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteBrand(id: string) {
  return deleteDoc(doc(db, "brands", id));
}

// ─── MAIN CATEGORIES ──────────────────────────────────────────────────────────

export async function getMainCategories() {
  const snap = await getDocs(query(collection(db, "main_categories"), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addMainCategory(data: { name: string; description?: string }) {
  return addDoc(collection(db, "main_categories"), { ...data, createdAt: serverTimestamp() });
}

export async function updateMainCategory(id: string, data: any) {
  return updateDoc(doc(db, "main_categories", id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteMainCategory(id: string) {
  return deleteDoc(doc(db, "main_categories", id));
}

// ─── SUB CATEGORIES ───────────────────────────────────────────────────────────

export async function getSubCategories(mainCategoryId?: string) {
  const q = mainCategoryId
    ? query(collection(db, "sub_categories"), where("mainCategoryId", "==", mainCategoryId), orderBy("name"))
    : query(collection(db, "sub_categories"), orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addSubCategory(data: { name: string; mainCategoryId: string; description?: string }) {
  return addDoc(collection(db, "sub_categories"), { ...data, createdAt: serverTimestamp() });
}

export async function updateSubCategory(id: string, data: any) {
  return updateDoc(doc(db, "sub_categories", id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteSubCategory(id: string) {
  return deleteDoc(doc(db, "sub_categories", id));
}

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────

export async function getProducts() {
  const snap = await getDocs(query(collection(db, "products"), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getProduct(id: string) {
  const snap = await getDoc(doc(db, "products", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function addProduct(data: {
  name: string;
  brandId: string;
  mainCategoryId: string;
  subCategoryId: string;
  sku: string;
  sellingPrice: number;
  totalStock: number;
  description?: string;
  warrantyMonths?: number;
  lowStockAlert?: number;
  active?: boolean;
}) {
  const batch = writeBatch(db);
  const productRef = doc(collection(db, "products"));
  batch.set(productRef, {
    ...data,
    active: data.active ?? true,
    lowStockAlert: data.lowStockAlert ?? 5,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return productRef;
}

export async function updateProduct(id: string, data: any) {
  return updateDoc(doc(db, "products", id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteProduct(id: string) {
  return deleteDoc(doc(db, "products", id));
}

// ─── PRODUCT BATCHES (price tracking) ─────────────────────────────────────────

export async function addBatch(
  productId: string,
  data: { costPrice: number; qty: number; supplierId?: string; note?: string }
) {
  return runTransaction(db, async (tx) => {
    const batchRef = doc(collection(db, "products", productId, "batches"));
    tx.set(batchRef, {
      costPrice: data.costPrice,
      totalQty: data.qty,
      remainingQty: data.qty,
      supplierId: data.supplierId ?? null,
      note: data.note ?? "",
      status: "active",
      receivedAt: serverTimestamp(),
    });
    tx.update(doc(db, "products", productId), {
      totalStock: increment(data.qty),
    });
  });
}

export async function getBatches(productId: string) {
  const snap = await getDocs(
    query(
      collection(db, "products", productId, "batches"),
      where("status", "==", "active"),
      orderBy("receivedAt", "asc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─── WARRANTY ─────────────────────────────────────────────────────────────────

export async function getWarranties() {
  const snap = await getDocs(query(collection(db, "warranties"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addWarranty(data: {
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  saleId: string;
  serialNumber?: string;
  warrantyMonths: number;
  startDate: Date;
}) {
  const endDate = new Date(data.startDate);
  endDate.setMonth(endDate.getMonth() + data.warrantyMonths);
  return addDoc(collection(db, "warranties"), {
    ...data,
    endDate,
    status: "active",
    createdAt: serverTimestamp(),
  });
}

export async function getWarrantyByCustomer(customerId: string) {
  const snap = await getDocs(
    query(collection(db, "warranties"), where("customerId", "==", customerId))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─── CUSTOMERS ────────────────────────────────────────────────────────────────

export async function getCustomers() {
  const snap = await getDocs(query(collection(db, "customers"), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addCustomer(data: {
  name: string;
  phone: string;
  email?: string;
  address?: string;
}) {
  return addDoc(collection(db, "customers"), {
    ...data,
    loyaltyPoints: 0,
    createdAt: serverTimestamp(),
  });
}

export async function updateCustomer(id: string, data: any) {
  return updateDoc(doc(db, "customers", id), { ...data, updatedAt: serverTimestamp() });
}

// ─── SALES (POS checkout) ─────────────────────────────────────────────────────

export interface SaleItem {
  productId: string;
  productName: string;
  sku: string;
  qty: number;
  unitPrice: number;
  costPrice: number;
  discount: number;
  lineTotal: number;
  warrantyMonths?: number;
}

export interface SaleData {
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
}

async function getNextInvoiceNumber(): Promise<string> {
  const counterRef = doc(db, "counters", "invoice");
  let invoiceNo = "";
  await runTransaction(db, async (tx) => {
    const counterDoc = await tx.get(counterRef);
    const current = counterDoc.exists() ? (counterDoc.data().value as number) : 0;
    const next = current + 1;
    tx.set(counterRef, { value: next });
    invoiceNo = `INV-${String(next).padStart(5, "0")}`;
  });
  return invoiceNo;
}

export async function createSale(data: SaleData) {
  return runTransaction(db, async (tx) => {
    // 1. Generate invoice number
    const counterRef = doc(db, "counters", "invoice");
    const counterDoc = await tx.get(counterRef);
    const current = counterDoc.exists() ? (counterDoc.data().value as number) : 0;
    const next = current + 1;
    tx.set(counterRef, { value: next });
    const invoiceNo = `INV-${String(next).padStart(5, "0")}`;

    // 2. Create sale doc
    const saleRef = doc(collection(db, "sales"));
    tx.set(saleRef, {
      ...data,
      invoiceNo,
      createdAt: serverTimestamp(),
    });

    // 3. Deduct stock for each item (FIFO across batches)
    for (const item of data.items) {
      tx.update(doc(db, "products", item.productId), {
        totalStock: increment(-item.qty),
      });
      // Log stock movement
      const mvRef = doc(collection(db, "stock_movements"));
      tx.set(mvRef, {
        productId: item.productId,
        type: "out",
        qty: -item.qty,
        referenceId: saleRef.id,
        referenceType: "sale",
        note: `Sale ${invoiceNo}`,
        performedBy: data.cashierId,
        createdAt: serverTimestamp(),
      });
    }

    // 4. Create sale items subcollection
    for (const item of data.items) {
      const itemRef = doc(collection(db, "sales", saleRef.id, "saleItems"));
      tx.set(itemRef, item);
    }

    return { saleId: saleRef.id, invoiceNo };
  });
}

export async function getSales() {
  const snap = await getDocs(query(collection(db, "sales"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getSale(id: string) {
  const saleDoc = await getDoc(doc(db, "sales", id));
  if (!saleDoc.exists()) return null;
  const items = await getDocs(collection(db, "sales", id, "saleItems"));
  return {
    id: saleDoc.id,
    ...saleDoc.data(),
    items: items.docs.map((d) => d.data()),
  };
}

// ─── STOCK MOVEMENTS ──────────────────────────────────────────────────────────

export async function getStockMovements(productId?: string) {
  const q = productId
    ? query(collection(db, "stock_movements"), where("productId", "==", productId), orderBy("createdAt", "desc"))
    : query(collection(db, "stock_movements"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─── SUPPLIERS ────────────────────────────────────────────────────────────────

export async function getSuppliers() {
  const snap = await getDocs(query(collection(db, "suppliers"), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addSupplier(data: { name: string; phone: string; email?: string; address?: string }) {
  return addDoc(collection(db, "suppliers"), { ...data, createdAt: serverTimestamp() });
}
