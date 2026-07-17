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
import type { ShopSettings, UserProfile, JobStatus } from "@/types";

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
      lowStockAlerted: false,
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
    tx.update(doc(db, "products", productId), { totalStock: increment(serials.length), lowStockAlerted: false });
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
      tx.update(doc(db, "products", productId), {
        totalStock: increment(delta),
        ...(delta > 0 ? { lowStockAlerted: false } : {}),
      });
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
  batchAllocations?: { batchId: string; qty: number }[];
}

export interface SaleData {
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
  pointsRedeemed?: number;
  paymentMethod: "cash" | "card" | "transfer";
  paymentStatus: "paid" | "partial" | "pending";
  amountTendered?: number;
  changeAmount?: number;
  note?: string;
}

// Discovers which batches a product could draw from, oldest first. This has
// to run outside the transaction (Firestore transactions can only get()
// specific documents, not run queries) — their live quantities are re-read
// fresh inside the transaction below, so Firestore's optimistic concurrency
// retries the whole sale if another checkout changes a batch's remainingQty
// before this one commits, instead of both sales silently oversell­ing it.
async function getCandidateBatchIds(productId: string, preferredBatchId?: string | null): Promise<string[]> {
  const snap = await getDocs(query(collection(db, "products", productId, "batches"), orderBy("receivedAt", "asc")));
  let ids = snap.docs.map((d) => d.id);
  if (preferredBatchId && ids.includes(preferredBatchId)) {
    ids = [preferredBatchId, ...ids.filter((id) => id !== preferredBatchId)];
  }
  return ids;
}

// Allocates a sale qty across a product's active batches, oldest first (or the
// cashier-picked batch first), from transaction-fresh batch snapshots so each
// batch's remainingQty reflects what's actually left at commit time and the
// sale records the true weighted cost price (not the client-supplied one).
// Throws if the active batches can't cover the requested qty — the caller runs
// this before any writes are issued, so the whole sale transaction aborts
// cleanly instead of overselling and recording a bogus cost price.
function allocateFifo(batchIds: string[], batchSnaps: any[], qty: number, productName: string) {
  const batches = batchIds
    .map((id, i) => ({ id, ...(batchSnaps[i].exists() ? batchSnaps[i].data() : {}) }))
    .filter((b) => b.status === "active") as { id: string; remainingQty: number; costPrice: number }[];

  let toConsume = qty;
  let totalCost = 0;
  const consumed: { batchId: string; qty: number; remainingAfter: number }[] = [];

  for (const batch of batches) {
    if (toConsume <= 0) break;
    const take = Math.min(toConsume, batch.remainingQty);
    if (take <= 0) continue;
    consumed.push({ batchId: batch.id, qty: take, remainingAfter: batch.remainingQty - take });
    totalCost += take * batch.costPrice;
    toConsume -= take;
  }

  if (toConsume > 0) {
    const available = qty - toConsume;
    throw new Error(`Not enough stock for "${productName}": requested ${qty}, only ${available} available.`);
  }

  const costPrice = qty > 0 ? totalCost / qty : 0;
  return { consumed, costPrice };
}

// Serialized items already know exactly which unit (and therefore which batch)
// is being sold, so consumption is grouped by each unit's batchId instead of FIFO.
function allocateFromUnits(batchIds: string[], batchSnaps: any[], units: { unitId: string; batchId: string }[]) {
  const remMap = new Map(batchIds.map((id, i) => [id, batchSnaps[i].exists() ? batchSnaps[i].data().remainingQty : 0]));
  const costMap = new Map(batchIds.map((id, i) => [id, batchSnaps[i].exists() ? batchSnaps[i].data().costPrice : 0]));

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
  // Discover candidate batch ids up front (see getCandidateBatchIds above).
  const candidateBatchIds = await Promise.all(
    data.items.map((item) =>
      item.units && item.units.length > 0
        ? Promise.resolve(Array.from(new Set(item.units.map((u) => u.batchId))))
        : getCandidateBatchIds(item.productId, item.batchId)
    )
  );

  return runTransaction(db, async (tx) => {
    // ---- Reads (a transaction's reads must all happen before its writes) ----
    const counterRef = doc(db, "counters", "invoice");
    const counterDoc = await tx.get(counterRef);

    const batchSnaps: any[][] = await Promise.all(
      data.items.map((item, i) =>
        Promise.all(candidateBatchIds[i].map((id) => tx.get(doc(db, "products", item.productId, "batches", id))))
      )
    );

    const unitSnaps: any[][] = await Promise.all(
      data.items.map((item) =>
        item.units && item.units.length > 0
          ? Promise.all(item.units.map((u) => tx.get(doc(db, "products", item.productId, "units", u.unitId))))
          : Promise.resolve([])
      )
    );

    // Read each sold product once (dedup'd — a serialized item can span
    // multiple cart lines for the same product) so post-sale stock and its
    // low-stock-alert threshold/flag can be checked against a fresh snapshot.
    const productIds = Array.from(new Set(data.items.map((item) => item.productId)));
    const productSnaps = await Promise.all(productIds.map((id) => tx.get(doc(db, "products", id))));
    const productDataById = new Map(productIds.map((id, i) => [id, productSnaps[i].exists() ? productSnaps[i].data()! : null]));

    // A unit picked at add-to-cart time may have been sold by someone else by
    // the time this transaction runs — fail loudly instead of double-selling it.
    data.items.forEach((item, i) => {
      if (!item.units || item.units.length === 0) return;
      unitSnaps[i].forEach((snap, j) => {
        if (!snap.exists() || snap.data()!.status !== "in_stock") {
          throw new Error(`"${item.units![j].serialNumber}" is no longer available for sale`);
        }
      });
    });

    const allocations = data.items.map((item, i) =>
      item.units && item.units.length > 0
        ? allocateFromUnits(candidateBatchIds[i], batchSnaps[i], item.units)
        : allocateFifo(candidateBatchIds[i], batchSnaps[i], item.qty, item.productName)
    );

    // ---- Writes ----
    const current = counterDoc.exists() ? (counterDoc.data().value as number) : 0;
    const next = current + 1;
    tx.set(counterRef, { value: next });
    const invoiceNo = `INV-${String(next).padStart(5, "0")}`;

    const saleRef = doc(collection(db, "sales"));
    const saleData = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    tx.set(saleRef, {
      ...saleData,
      invoiceNo,
      createdAt: serverTimestamp(),
    });

    // Non-serialized items don't otherwise record which batch(es) FIFO drew
    // from, so persist that breakdown here — cancelSale needs it to restore
    // the exact batches instead of guessing from the cashier-picked batchId.
    const itemsWithCost = data.items.map((item, i) => ({
      ...item,
      costPrice: allocations[i].costPrice,
      batchAllocations: allocations[i].consumed.map((c) => ({ batchId: c.batchId, qty: c.qty })),
    }));
    const saleDate = new Date();

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

      // Warranty for this line item, created atomically with the sale itself
      // instead of as a follow-up call — a mid-flight failure here now rolls
      // back the whole sale rather than leaving one on record with no warranty.
      if ((item.warrantyMonths ?? 0) > 0) {
        const targets = item.units && item.units.length > 0 ? item.units : [null];
        for (const unit of targets) {
          const endDate = new Date(saleDate);
          endDate.setMonth(endDate.getMonth() + item.warrantyMonths!);
          const wRef = doc(collection(db, "warranties"));
          const payload: any = {
            customerId: data.customerId ?? null,
            customerName: data.customerName || "Walk-in Customer",
            productId: item.productId,
            productName: item.productName,
            saleId: saleRef.id,
            warrantyMonths: item.warrantyMonths,
            startDate: saleDate,
            endDate,
            status: "active",
            createdAt: serverTimestamp(),
          };
          if (unit?.serialNumber) payload.serialNumber = unit.serialNumber;
          tx.set(wRef, payload);
        }
      }
    });

    for (const item of itemsWithCost) {
      const itemRef = doc(collection(db, "sales", saleRef.id, "saleItems"));
      tx.set(itemRef, item);
    }

    // Low-stock detection: a product alerts once when this sale takes it to
    // or below its threshold, then goes quiet (lowStockAlerted) until a
    // restock resets the flag — otherwise every subsequent sale of an
    // already-low item would re-fire the same email.
    const qtySoldByProduct = new Map<string, number>();
    for (const item of data.items) {
      qtySoldByProduct.set(item.productId, (qtySoldByProduct.get(item.productId) ?? 0) + item.qty);
    }
    const lowStockItems: { productId: string; productName: string; sku: string; totalStock: number; lowStockAlert: number }[] = [];
    for (const [productId, qtySold] of Array.from(qtySoldByProduct.entries())) {
      const productData = productDataById.get(productId);
      if (!productData) continue;
      const newStock = (productData.totalStock ?? 0) - qtySold;
      const threshold = productData.lowStockAlert ?? 5;
      if (newStock <= threshold && !productData.lowStockAlerted) {
        tx.update(doc(db, "products", productId), { lowStockAlerted: true });
        lowStockItems.push({ productId, productName: productData.name, sku: productData.sku, totalStock: newStock, lowStockAlert: threshold });
      }
    }

    // Loyalty points earned/redeemed on this sale, applied in the same
    // transaction as everything above so it can never drift from the sale.
    if (data.customerId) {
      const pointsEarned = Math.floor((data.subtotal - data.discountAmount) / 100);
      const pointsRedeemed = data.pointsRedeemed || 0;
      const delta = pointsEarned - pointsRedeemed;
      if (delta !== 0) {
        tx.update(doc(db, "customers", data.customerId), {
          loyaltyPoints: increment(delta),
          updatedAt: serverTimestamp(),
        });
      }
    }

    return { saleId: saleRef.id, invoiceNo, lowStockItems };
  });
}

export async function getSales() {
  const snap = await getDocs(query(collection(db, "sales"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getAllSaleItems() {
  const snap = await getDocs(collectionGroup(db, "saleItems"));
  return snap.docs.map((d) => ({ ...d.data(), saleId: d.ref.parent.parent?.id }));
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

// Reverses a sale: restores product/batch/unit stock, undoes any loyalty points
// earned or redeemed, drops the warranties it created, and marks the sale
// "cancelled" (soft — the invoice and its items are kept for audit history).
export async function cancelSale(saleId: string, cancelledBy: { uid: string; name: string }, reason: string) {
  const saleRef = doc(db, "sales", saleId);
  const saleSnap = await getDoc(saleRef);
  if (!saleSnap.exists()) throw new Error("Bill not found");
  const sale = saleSnap.data() as SaleData & { invoiceNo: string; status?: string };
  if (sale.status === "cancelled") throw new Error("Bill is already cancelled");

  const itemsSnap = await getDocs(collection(db, "sales", saleId, "saleItems"));
  const items = itemsSnap.docs.map((d) => d.data() as SaleItem);

  const warrantySnap = await getDocs(query(collection(db, "warranties"), where("saleId", "==", saleId)));

  // Serialized items restore their exact batch via each unit; non-serialized
  // items restore via the batchAllocations recorded at checkout time (the
  // real batch(es) FIFO drew from). Sales made before batchAllocations existed
  // fall back to the cashier-selected batchId as a best-effort approximation.
  const batchTargets = new Map<string, { productId: string; batchId: string; qty: number }>();
  for (const item of items) {
    if (item.units && item.units.length > 0) {
      for (const u of item.units) {
        const key = `${item.productId}/${u.batchId}`;
        const t = batchTargets.get(key) ?? { productId: item.productId, batchId: u.batchId, qty: 0 };
        t.qty += 1;
        batchTargets.set(key, t);
      }
    } else if (item.batchAllocations && item.batchAllocations.length > 0) {
      for (const a of item.batchAllocations) {
        const key = `${item.productId}/${a.batchId}`;
        const t = batchTargets.get(key) ?? { productId: item.productId, batchId: a.batchId, qty: 0 };
        t.qty += a.qty;
        batchTargets.set(key, t);
      }
    } else if (item.batchId) {
      const key = `${item.productId}/${item.batchId}`;
      const t = batchTargets.get(key) ?? { productId: item.productId, batchId: item.batchId, qty: 0 };
      t.qty += item.qty;
      batchTargets.set(key, t);
    }
  }

  // Batches/units could have been deleted since the sale, so check existence up
  // front — a transaction update against a missing doc would abort the whole thing.
  const batchChecks = await Promise.all(
    Array.from(batchTargets.values()).map(async (t) => ({
      ...t,
      exists: (await getDoc(doc(db, "products", t.productId, "batches", t.batchId))).exists(),
    }))
  );
  const allUnits = items.flatMap((item) =>
    (item.units ?? []).map((u) => ({ productId: item.productId, unitId: u.unitId }))
  );
  const unitChecks = await Promise.all(
    allUnits.map(async (u) => ({
      ...u,
      exists: (await getDoc(doc(db, "products", u.productId, "units", u.unitId))).exists(),
    }))
  );

  return runTransaction(db, async (tx) => {
    tx.update(saleRef, {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
      cancelledById: cancelledBy.uid,
      cancelledByName: cancelledBy.name,
      cancelReason: reason || "",
    });

    for (const item of items) {
      tx.update(doc(db, "products", item.productId), {
        totalStock: increment(item.qty),
        lowStockAlerted: false,
      });

      const mvRef = doc(collection(db, "stock_movements"));
      tx.set(mvRef, {
        productId: item.productId,
        type: "in",
        qty: item.qty,
        referenceId: saleId,
        referenceType: "sale_cancel",
        note: `Cancelled ${sale.invoiceNo}`,
        performedBy: cancelledBy.uid,
        createdAt: serverTimestamp(),
      });
    }

    for (const b of batchChecks) {
      if (!b.exists) continue;
      tx.update(doc(db, "products", b.productId, "batches", b.batchId), {
        remainingQty: increment(b.qty),
        status: "active",
      });
    }

    for (const u of unitChecks) {
      if (!u.exists) continue;
      tx.update(doc(db, "products", u.productId, "units", u.unitId), {
        status: "in_stock",
        saleId: null,
        soldAt: null,
      });
    }

    if (sale.customerId) {
      const pointsEarned = Math.floor((sale.subtotal - sale.discountAmount) / 100);
      const pointsRedeemed = sale.pointsRedeemed || 0;
      const delta = pointsRedeemed - pointsEarned;
      if (delta !== 0) {
        tx.update(doc(db, "customers", sale.customerId), { loyaltyPoints: increment(delta) });
      }
    }

    for (const w of warrantySnap.docs) {
      tx.delete(w.ref);
    }
  });
}

// ─── QUOTATIONS ───────────────────────────────────────────────────────────────
// Quotations are informational only — unlike sales they never touch stock,
// so creation/update is plain document writes instead of stock-aware transactions.

export interface QuotationItemData {
  productId?: string | null;
  productName: string;
  sku?: string;
  qty: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

export interface QuotationData {
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  preparedById: string;
  preparedByName: string;
  items: QuotationItemData[];
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  validUntil: Date;
  note?: string;
}

export async function createQuotation(data: QuotationData) {
  return runTransaction(db, async (tx) => {
    const counterRef = doc(db, "counters", "quotation");
    const counterDoc = await tx.get(counterRef);
    const current = counterDoc.exists() ? (counterDoc.data().value as number) : 0;
    const next = current + 1;
    tx.set(counterRef, { value: next });
    const quotationNo = `QUO-${String(next).padStart(5, "0")}`;

    const quotationRef = doc(collection(db, "quotations"));
    tx.set(quotationRef, {
      ...data,
      quotationNo,
      status: "sent",
      createdAt: serverTimestamp(),
    });

    return { quotationId: quotationRef.id, quotationNo };
  });
}

export async function getQuotations() {
  const snap = await getDocs(query(collection(db, "quotations"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getQuotation(id: string) {
  const snap = await getDoc(doc(db, "quotations", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateQuotation(id: string, data: Partial<QuotationData>) {
  return updateDoc(doc(db, "quotations", id), { ...data, updatedAt: serverTimestamp() });
}

export async function updateQuotationStatus(id: string, status: string) {
  return updateDoc(doc(db, "quotations", id), { status, updatedAt: serverTimestamp() });
}

export async function deleteQuotation(id: string) {
  return deleteDoc(doc(db, "quotations", id));
}

// ─── JOBS (service job notes) ─────────────────────────────────────────────────
// Job intake is informational only — like quotations it never touches stock,
// so creation is a plain document write plus a counter transaction for the
// job number. Every status change (Pending/Ongoing/Done/Can't Repair) is
// recorded as an entry in the jobs/{id}/statusHistory subcollection instead
// of just overwriting the job doc, so the full "who changed what, and when"
// audit trail required for job reporting is preserved.

export interface JobData {
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
  expectedDeliveryDate?: Date | null;
}

export async function createJob(data: JobData) {
  return runTransaction(db, async (tx) => {
    const counterRef = doc(db, "counters", "job");
    const counterDoc = await tx.get(counterRef);
    const current = counterDoc.exists() ? (counterDoc.data().value as number) : 0;
    const next = current + 1;
    tx.set(counterRef, { value: next });
    const jobNo = `JOB-${String(next).padStart(5, "0")}`;

    const jobRef = doc(collection(db, "jobs"));
    const jobData = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    tx.set(jobRef, {
      ...jobData,
      jobNo,
      status: "pending",
      repairCost: null,
      createdAt: serverTimestamp(),
    });

    const historyRef = doc(collection(db, "jobs", jobRef.id, "statusHistory"));
    tx.set(historyRef, {
      status: "pending",
      note: "Job received",
      repairCost: null,
      updatedById: data.receivedById,
      updatedByName: data.receivedByName,
      createdAt: serverTimestamp(),
    });

    return { jobId: jobRef.id, jobNo };
  });
}

export async function getJobs() {
  const snap = await getDocs(query(collection(db, "jobs"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getJob(id: string) {
  const jobDoc = await getDoc(doc(db, "jobs", id));
  if (!jobDoc.exists()) return null;
  const history = await getDocs(
    query(collection(db, "jobs", id, "statusHistory"), orderBy("createdAt", "desc"))
  );
  return {
    id: jobDoc.id,
    ...jobDoc.data(),
    statusHistory: history.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

// Every job in the system, each carrying its full statusHistory — powers the
// date-range job report (all jobs + every processing activity in one shot).
export async function getAllJobsWithHistory() {
  const jobs = await getJobs();
  return Promise.all(
    jobs.map(async (job: any) => {
      const history = await getDocs(
        query(collection(db, "jobs", job.id, "statusHistory"), orderBy("createdAt", "asc"))
      );
      return { ...job, statusHistory: history.docs.map((d) => ({ id: d.id, ...d.data() })) };
    })
  );
}

export async function updateJobStatus(
  jobId: string,
  change: { status: JobStatus; note?: string; repairCost?: number | null },
  updatedBy: { uid: string; name: string }
) {
  return runTransaction(db, async (tx) => {
    const jobRef = doc(db, "jobs", jobId);
    const jobSnap = await tx.get(jobRef);
    if (!jobSnap.exists()) throw new Error("Job not found");

    const patch: Record<string, any> = { status: change.status, updatedAt: serverTimestamp() };
    if (change.repairCost !== undefined) patch.repairCost = change.repairCost;
    if (change.status === "done") patch.dateReturned = serverTimestamp();
    tx.update(jobRef, patch);

    const historyRef = doc(collection(db, "jobs", jobId, "statusHistory"));
    tx.set(historyRef, {
      status: change.status,
      note: change.note || "",
      repairCost: change.repairCost ?? null,
      updatedById: updatedBy.uid,
      updatedByName: updatedBy.name,
      createdAt: serverTimestamp(),
    });
  });
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

export async function updateShopSettings(data: Partial<ShopSettings>) {
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
  // Team members are meant to be provisioned by an Admin+ via createTeamUser,
  // which always sets an explicit role. If this ever runs for a user with no
  // profile doc yet, default to the least-privileged role rather than Admin —
  // self-service profile saves should never be able to grant elevated access.
  return setDoc(ref, { uid, role: "Cashier", ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
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

// Equality-only (no orderBy) so it doesn't need a composite index, and so the
// firestore.rules `resource.data.role == 'Technician'` read rule can hold for
// every doc the query returns — letting any staff member (not just Admin+)
// list technicians to assign a job to.
export async function getTechnicians(): Promise<UserProfile[]> {
  const snap = await getDocs(query(collection(db, "users"), where("role", "==", "Technician")));
  return snap.docs
    .map((d) => ({ uid: d.id, ...d.data() } as UserProfile))
    .filter((u) => u.status !== "inactive")
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
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
    { key: "quotations",      label: "Quotations",       avgBytes: 900  },
    { key: "jobs",            label: "Jobs",             avgBytes: 900  },
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

export async function getCollectionData(collectionName: string): Promise<Record<string, any>[]> {
  const snap = await getDocs(collection(db, collectionName));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─── CLEAN COLLECTION ─────────────────────────────────────────────────────────

const SUBCOLLECTIONS: Record<string, string[]> = {
  products: ["batches"],
  sales: ["saleItems"],
  jobs: ["statusHistory"],
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
