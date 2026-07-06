import {
  collection, collectionGroup, doc, addDoc, updateDoc, deleteDoc, setDoc,
  getDocs, getDoc, query, where, orderBy, limit,
  serverTimestamp, FieldValue, increment,
  runTransaction, Timestamp, writeBatch, getCountFromServer,
} from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { db } from "./firebase";
import { firebaseConfig } from "./firebase";
import type { ShopSettings, UserProfile } from "@/types";

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
  trackSerial?: boolean;
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
  data: { costPrice: number; sellingPrice?: number; qty: number; supplierId?: string; note?: string; serials?: string[] }
) {
  const qty = data.serials?.length ?? data.qty;
  return runTransaction(db, async (tx) => {
    const batchRef = doc(collection(db, "products", productId, "batches"));
    tx.set(batchRef, {
      costPrice: data.costPrice,
      sellingPrice: data.sellingPrice ?? null,
      totalQty: qty,
      remainingQty: qty,
      supplierId: data.supplierId ?? null,
      note: data.note ?? "",
      status: "active",
      receivedAt: serverTimestamp(),
    });
    for (const serialNumber of data.serials ?? []) {
      const unitRef = doc(collection(db, "products", productId, "units"));
      tx.set(unitRef, {
        serialNumber,
        batchId: batchRef.id,
        costPrice: data.costPrice,
        sellingPrice: data.sellingPrice ?? null,
        status: "in_stock",
        createdAt: serverTimestamp(),
      });
    }
    tx.update(doc(db, "products", productId), {
      totalStock: increment(qty),
    });
  });
}

// ─── PRODUCT UNITS (serial numbers) ───────────────────────────────────────────

export async function getAllUnits(productId: string) {
  const snap = await getDocs(collection(db, "products", productId, "units"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getAvailableUnits(productId: string) {
  const snap = await getDocs(
    query(
      collection(db, "products", productId, "units"),
      where("status", "==", "in_stock"),
      orderBy("createdAt", "asc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getUnitsByBatch(productId: string, batchId: string) {
  const snap = await getDocs(
    query(collection(db, "products", productId, "units"), where("batchId", "==", batchId))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updateUnitSerial(productId: string, unitId: string, serialNumber: string) {
  return updateDoc(doc(db, "products", productId, "units", unitId), { serialNumber });
}

// Only in-stock units can be removed — sold units stay put since they're tied to a sale/warranty.
export async function deleteUnit(productId: string, unitId: string, batchId: string) {
  return runTransaction(db, async (tx) => {
    const unitRef = doc(db, "products", productId, "units", unitId);
    const batchRef = doc(db, "products", productId, "batches", batchId);
    const [unitSnap, batchSnap] = await Promise.all([tx.get(unitRef), tx.get(batchRef)]);
    if (!unitSnap.exists()) throw new Error("Unit not found");
    const unit = unitSnap.data() as { status: string };
    if (unit.status !== "in_stock") throw new Error("Cannot remove a unit that has already been sold");

    tx.delete(unitRef);
    if (batchSnap.exists()) {
      const batch = batchSnap.data() as { remainingQty: number };
      const newRemaining = batch.remainingQty - 1;
      tx.update(batchRef, {
        totalQty: increment(-1),
        remainingQty: increment(-1),
        status: newRemaining <= 0 ? "depleted" : "active",
      });
    }
    tx.update(doc(db, "products", productId), { totalStock: increment(-1) });
  });
}

export async function addUnitsToBatch(productId: string, batchId: string, serials: string[]) {
  return runTransaction(db, async (tx) => {
    const batchRef = doc(db, "products", productId, "batches", batchId);
    const batchSnap = await tx.get(batchRef);
    if (!batchSnap.exists()) throw new Error("Batch not found");
    const batch = batchSnap.data() as { costPrice: number; sellingPrice?: number | null };

    for (const serialNumber of serials) {
      const unitRef = doc(collection(db, "products", productId, "units"));
      tx.set(unitRef, {
        serialNumber,
        batchId,
        costPrice: batch.costPrice,
        sellingPrice: batch.sellingPrice ?? null,
        status: "in_stock",
        createdAt: serverTimestamp(),
      });
    }
    tx.update(batchRef, {
      totalQty: increment(serials.length),
      remainingQty: increment(serials.length),
      status: "active",
    });
    tx.update(doc(db, "products", productId), { totalStock: increment(serials.length) });
  });
}

export async function getBatches(productId: string) {
  const snap = await getDocs(
    query(collection(db, "products", productId, "batches"), orderBy("receivedAt", "asc"))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((b: any) => b.status === "active");
}

export async function getAllBatches(productId: string) {
  const snap = await getDocs(
    query(collection(db, "products", productId, "batches"), orderBy("receivedAt", "asc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updateBatch(
  productId: string,
  batchId: string,
  data: { costPrice: number; sellingPrice?: number; totalQty: number; remainingQty: number; note?: string },
  performedBy?: string
) {
  return runTransaction(db, async (tx) => {
    const batchRef = doc(db, "products", productId, "batches", batchId);
    const batchSnap = await tx.get(batchRef);
    if (!batchSnap.exists()) throw new Error("Batch not found");
    const current = batchSnap.data() as { remainingQty: number };

    tx.update(batchRef, {
      costPrice: data.costPrice,
      sellingPrice: data.sellingPrice ?? null,
      totalQty: data.totalQty,
      remainingQty: data.remainingQty,
      note: data.note ?? "",
      status: data.remainingQty <= 0 ? "depleted" : "active",
    });

    // Keep the product's aggregate stock in sync with the corrected quantity.
    const delta = data.remainingQty - current.remainingQty;
    if (delta !== 0) {
      tx.update(doc(db, "products", productId), { totalStock: increment(delta) });
      const mvRef = doc(collection(db, "stock_movements"));
      tx.set(mvRef, {
        productId,
        type: "adjustment",
        qty: delta,
        referenceId: batchId,
        referenceType: "batch_edit",
        note: "Batch quantity corrected",
        performedBy: performedBy || "unknown",
        createdAt: serverTimestamp(),
      });
    }
  });
}

// ─── WARRANTY ─────────────────────────────────────────────────────────────────

export async function getWarranties() {
  const snap = await getDocs(query(collection(db, "warranties"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addWarranty(data: {
  customerId: string | null;
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
  const payload: any = {
    ...data,
    endDate,
    status: "active",
    createdAt: serverTimestamp(),
  };
  if (payload.serialNumber === undefined) delete payload.serialNumber;
  return addDoc(collection(db, "warranties"), payload);
}

export async function claimWarranty(id: string, note: string) {
  return updateDoc(doc(db, "warranties", id), {
    status: "claimed",
    claimNote: note,
    claimedAt: serverTimestamp(),
  });
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

export async function addLoyaltyPoints(customerId: string, points: number) {
  return updateDoc(doc(db, "customers", customerId), {
    loyaltyPoints: increment(points),
    updatedAt: serverTimestamp(),
  });
}

export async function redeemLoyaltyPoints(customerId: string, points: number) {
  return updateDoc(doc(db, "customers", customerId), {
    loyaltyPoints: increment(-points),
    updatedAt: serverTimestamp(),
  });
}

// ─── SALES (POS checkout) ─────────────────────────────────────────────────────

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
  units?: { unitId: string; serialNumber: string; batchId: string }[];
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
  pointsRedeemed?: number;
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

// Allocates a sale qty across a product's active batches, oldest first,
// so each batch's remainingQty reflects what's actually left and the sale
// records the true weighted cost price (not the client-supplied one).
async function allocateFifo(productId: string, qty: number, preferredBatchId?: string | null) {
  const activeBatches = (await getBatches(productId)) as { id: string; remainingQty: number; costPrice: number }[];

  // If the cashier picked a specific batch, draw from it first; FIFO covers any shortfall.
  let ordered = activeBatches;
  if (preferredBatchId) {
    const idx = activeBatches.findIndex((b) => b.id === preferredBatchId);
    if (idx > -1) {
      const rest = activeBatches.slice(0, idx).concat(activeBatches.slice(idx + 1));
      ordered = [activeBatches[idx], ...rest];
    }
  }

  let toConsume = qty;
  let totalCost = 0;
  const consumed: { batchId: string; qty: number; remainingAfter: number }[] = [];

  for (const batch of ordered) {
    if (toConsume <= 0) break;
    const take = Math.min(toConsume, batch.remainingQty);
    if (take <= 0) continue;
    consumed.push({ batchId: batch.id, qty: take, remainingAfter: batch.remainingQty - take });
    totalCost += take * batch.costPrice;
    toConsume -= take;
  }

  // Stock oversold relative to recorded batches — cost the shortfall at the last known batch price.
  if (toConsume > 0 && activeBatches.length > 0) {
    totalCost += toConsume * activeBatches[activeBatches.length - 1].costPrice;
  }

  const costPrice = qty > 0 ? totalCost / qty : 0;
  return { consumed, costPrice };
}

// Serialized items already know exactly which unit (and therefore which batch)
// is being sold, so consumption is grouped by each unit's batchId instead of FIFO.
async function allocateFromUnits(productId: string, units: { unitId: string; batchId: string }[]) {
  const batches = (await getAllBatches(productId)) as { id: string; remainingQty: number; costPrice: number }[];
  const remMap = new Map(batches.map((b) => [b.id, b.remainingQty]));
  const costMap = new Map(batches.map((b) => [b.id, b.costPrice]));

  const grouped = new Map<string, number>();
  for (const u of units) grouped.set(u.batchId, (grouped.get(u.batchId) ?? 0) + 1);

  const consumed = Array.from(grouped.entries()).map(([batchId, qty]) => ({
    batchId,
    qty,
    remainingAfter: (remMap.get(batchId) ?? qty) - qty,
  }));
  const totalCost = Array.from(grouped.entries()).reduce(
    (sum, [batchId, qty]) => sum + qty * (costMap.get(batchId) ?? 0),
    0
  );
  const costPrice = units.length ? totalCost / units.length : 0;
  return { consumed, costPrice };
}

export async function createSale(data: SaleData) {
  // Batch allocation requires querying each product's batches, which Firestore
  // transactions can't do mid-transaction — so resolve allocation first,
  // then apply all writes atomically. Serialized items allocate from their
  // chosen units; everything else falls back to FIFO across active batches.
  const allocations = await Promise.all(
    data.items.map((item) =>
      item.units && item.units.length > 0
        ? allocateFromUnits(item.productId, item.units)
        : allocateFifo(item.productId, item.qty, item.batchId)
    )
  );

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

    // 3. Deduct stock for each item and consume from its batches (FIFO)
    const itemsWithCost = data.items.map((item, i) => ({ ...item, costPrice: allocations[i].costPrice }));

    data.items.forEach((item, i) => {
      tx.update(doc(db, "products", item.productId), {
        totalStock: increment(-item.qty),
      });

      for (const c of allocations[i].consumed) {
        tx.update(doc(db, "products", item.productId, "batches", c.batchId), {
          remainingQty: increment(-c.qty),
          status: c.remainingAfter <= 0 ? "depleted" : "active",
        });
      }

      if (item.units && item.units.length > 0) {
        for (const u of item.units) {
          tx.update(doc(db, "products", item.productId, "units", u.unitId), {
            status: "sold",
            saleId: saleRef.id,
            soldAt: serverTimestamp(),
          });
        }
      }

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
    });

    // 4. Create sale items subcollection (with corrected cost price)
    for (const item of itemsWithCost) {
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

export async function getAllSaleItems() {
  const snap = await getDocs(collectionGroup(db, "saleItems"));
  return snap.docs.map((d) => d.data());
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

export async function updateSupplier(id: string, data: { name: string; phone: string; email?: string; address?: string }) {
  return updateDoc(doc(db, "suppliers", id), { ...data, updatedAt: serverTimestamp() });
}

// ─── SHOP SETTINGS ────────────────────────────────────────────────────────────

export async function getShopSettings() {
  const snap = await getDoc(doc(db, "shopSettings", "main"));
  return snap.exists() ? (snap.data() as ShopSettings) : null;
}

export async function updateShopSettings(data: ShopSettings) {
  return setDoc(doc(db, "shopSettings", "main"), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

// ─── USER PROFILE ─────────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? ({ uid: snap.id, ...snap.data() } as UserProfile) : null;
}

export async function upsertUserProfile(uid: string, data: Partial<Omit<UserProfile, "uid" | "createdAt">>) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  }
  return setDoc(ref, { uid, role: "Admin", ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function updateTeamUser(
  uid: string,
  data: Partial<Pick<UserProfile, "displayName" | "role" | "status">>
) {
  return updateDoc(doc(db, "users", uid), { ...data, updatedAt: serverTimestamp() });
}

export async function getTeamUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "asc")));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile));
}

export async function createTeamUser(
  email: string,
  password: string,
  displayName: string,
  role: string
): Promise<void> {
  // Use a secondary app instance so the current admin session is not affected
  const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await setDoc(doc(db, "users", cred.user.uid), {
      uid: cred.user.uid,
      email,
      displayName,
      role,
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } finally {
    await signOut(secondaryAuth);
    await deleteApp(secondaryApp);
  }
}

// ─── FIREBASE USAGE STATS ─────────────────────────────────────────────────────

export interface CollectionStat {
  key: string;
  label: string;
  count: number;
  avgBytes: number;
}

export async function getUsageStats(): Promise<CollectionStat[]> {
  const targets = [
    { key: "sales",           label: "Sales",            avgBytes: 1000 },
    { key: "stock_movements", label: "Stock Movements",  avgBytes: 350  },
    { key: "products",        label: "Products",         avgBytes: 700  },
    { key: "customers",       label: "Customers",        avgBytes: 400  },
    { key: "warranties",      label: "Warranties",       avgBytes: 500  },
    { key: "sub_categories",  label: "Sub Categories",   avgBytes: 250  },
    { key: "users",           label: "Users",            avgBytes: 400  },
    { key: "suppliers",       label: "Suppliers",        avgBytes: 350  },
    { key: "main_categories", label: "Main Categories",  avgBytes: 200  },
    { key: "brands",          label: "Brands",           avgBytes: 200  },
  ];

  const results = await Promise.all(
    targets.map(async (t) => {
      const snap = await getCountFromServer(collection(db, t.key));
      return { ...t, count: snap.data().count };
    })
  );

  return results;
}

// ─── CLEAN COLLECTION ─────────────────────────────────────────────────────────

const SUBCOLLECTIONS: Record<string, string[]> = {
  products: ["batches"],
  sales: ["saleItems"],
};

export async function cleanCollection(collectionName: string): Promise<number> {
  let totalDeleted = 0;
  while (true) {
    const snap = await getDocs(query(collection(db, collectionName), limit(500)));
    if (snap.empty) break;
    const subcols = SUBCOLLECTIONS[collectionName] ?? [];
    for (const docSnap of snap.docs) {
      for (const sub of subcols) {
        let subSnap;
        do {
          subSnap = await getDocs(query(collection(db, collectionName, docSnap.id, sub), limit(500)));
          if (!subSnap.empty) {
            const subBatch = writeBatch(db);
            subSnap.docs.forEach((d) => subBatch.delete(d.ref));
            await subBatch.commit();
          }
        } while (subSnap.docs.length === 500);
      }
    }
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    totalDeleted += snap.docs.length;
    if (snap.docs.length < 500) break;
  }
  return totalDeleted;
}
