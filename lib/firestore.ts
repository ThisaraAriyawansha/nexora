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
import type { ShopSettings, UserProfile, JobStatus, StockLocation, StockMovementReason, SupplierPaymentMethod, SupplierPaymentStatus } from "@/types";
import { diffFields, writeAuditLog } from "./audit";

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
  data: {
    costPrice: number;
    sellingPrice?: number;
    qty: number;
    supplierId?: string;
    note?: string;
    serials?: string[];
    location?: StockLocation;
  }
) {
  const qty = data.serials?.length ?? data.qty;
  // Ad-hoc batch adds (the Products page "Add Batch" quick-add) land in
  // Stores by default, same as a GRN — stock always arrives there first and
  // must be Transferred to Showroom before it's sellable via POS.
  const location: StockLocation = data.location ?? "stores";
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
      location,
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
        location,
        createdAt: serverTimestamp(),
      });
    }
    tx.update(doc(db, "products", productId), {
      totalStock: increment(qty),
      [location === "showroom" ? "showroomStock" : "storesStock"]: increment(qty),
      lowStockAlerted: false,
    });
  });
}

// ─── PRODUCT UNITS (serial numbers) ───────────────────────────────────────────

export async function getAllUnits(productId: string) {
  const snap = await getDocs(collection(db, "products", productId, "units"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Location filtered client-side (not via an extra `where`) so this keeps
// using the existing status+createdAt composite index instead of needing a
// new one provisioned in the Firebase console.
export async function getAvailableUnits(productId: string, location?: StockLocation) {
  const snap = await getDocs(
    query(
      collection(db, "products", productId, "units"),
      where("status", "==", "in_stock"),
      orderBy("createdAt", "asc")
    )
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u: any) => !location || u.location === location);
}

// Chunked `in` lookup (Firestore caps `in` at 30 values) — used by Stock
// Transfer / Stock-Out to resolve cashier/manager-picked serial numbers back
// to their unit docs.
export async function getUnitsBySerialNumbers(productId: string, serialNumbers: string[]) {
  const chunks: string[][] = [];
  for (let i = 0; i < serialNumbers.length; i += 30) chunks.push(serialNumbers.slice(i, i + 30));
  const results = await Promise.all(
    chunks.map((chunk) =>
      getDocs(query(collection(db, "products", productId, "units"), where("serialNumber", "in", chunk)))
    )
  );
  return results.flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })));
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
    const unit = unitSnap.data() as { status: string; location?: StockLocation };
    if (unit.status !== "in_stock") throw new Error("Cannot remove a unit that has already been sold");
    const location: StockLocation = unit.location ?? "stores";

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
    tx.update(doc(db, "products", productId), {
      totalStock: increment(-1),
      [location === "showroom" ? "showroomStock" : "storesStock"]: increment(-1),
    });
  });
}

export async function addUnitsToBatch(productId: string, batchId: string, serials: string[]) {
  return runTransaction(db, async (tx) => {
    const batchRef = doc(db, "products", productId, "batches", batchId);
    const batchSnap = await tx.get(batchRef);
    if (!batchSnap.exists()) throw new Error("Batch not found");
    const batch = batchSnap.data() as { costPrice: number; sellingPrice?: number | null; location?: StockLocation };
    const location: StockLocation = batch.location ?? "stores";

    for (const serialNumber of serials) {
      const unitRef = doc(collection(db, "products", productId, "units"));
      tx.set(unitRef, {
        serialNumber,
        batchId,
        costPrice: batch.costPrice,
        sellingPrice: batch.sellingPrice ?? null,
        status: "in_stock",
        location,
        createdAt: serverTimestamp(),
      });
    }
    tx.update(batchRef, {
      totalQty: increment(serials.length),
      remainingQty: increment(serials.length),
      status: "active",
    });
    tx.update(doc(db, "products", productId), {
      totalStock: increment(serials.length),
      [location === "showroom" ? "showroomStock" : "storesStock"]: increment(serials.length),
      lowStockAlerted: false,
    });
  });
}

export async function getBatches(productId: string, location?: StockLocation) {
  const snap = await getDocs(
    query(collection(db, "products", productId, "batches"), orderBy("receivedAt", "asc"))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((b: any) => b.status === "active" && (!location || b.location === location));
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
  performedBy?: string,
  performedByName?: string | null
) {
  return runTransaction(db, async (tx) => {
    const batchRef = doc(db, "products", productId, "batches", batchId);
    const batchSnap = await tx.get(batchRef);
    if (!batchSnap.exists()) throw new Error("Batch not found");
    const current = batchSnap.data() as { remainingQty: number; location?: StockLocation };
    const location: StockLocation = current.location ?? "stores";

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
        [location === "showroom" ? "showroomStock" : "storesStock"]: increment(delta),
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
        performedByName: performedByName || "",
        location,
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

// Discovers which batches a product could draw from, oldest first, scoped to
// a single location (Stores or Showroom — the two pools are never mixed in
// one allocation). This has to run outside the transaction (Firestore
// transactions can only get() specific documents, not run queries) — their
// live quantities are re-read fresh inside the transaction below, so
// Firestore's optimistic concurrency retries the whole operation if another
// checkout/transfer changes a batch's remainingQty before this one commits,
// instead of silently overselling it. Location is filtered client-side
// (rather than an extra `where`) so no new composite index is needed.
async function getCandidateBatchIds(
  productId: string,
  location: StockLocation,
  preferredBatchId?: string | null
): Promise<string[]> {
  const snap = await getDocs(query(collection(db, "products", productId, "batches"), orderBy("receivedAt", "asc")));
  let ids = snap.docs.filter((d) => (d.data().location ?? "stores") === location).map((d) => d.id);
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
  // POS only ever sells from Showroom Stock — Stores Stock has to be
  // Transferred to Showroom first. Discover candidate batch ids up front
  // (see getCandidateBatchIds above), scoped to showroom.
  const candidateBatchIds = await Promise.all(
    data.items.map((item) =>
      item.units && item.units.length > 0
        ? Promise.resolve(Array.from(new Set(item.units.map((u) => u.batchId))))
        : getCandidateBatchIds(item.productId, "showroom", item.batchId)
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

    // A unit picked at add-to-cart time may have been sold (or transferred
    // back to Stores) by someone else by the time this transaction runs —
    // fail loudly instead of double-selling it.
    data.items.forEach((item, i) => {
      if (!item.units || item.units.length === 0) return;
      unitSnaps[i].forEach((snap, j) => {
        const u = snap.exists() ? (snap.data() as { status: string; location?: StockLocation }) : null;
        if (!u || u.status !== "in_stock" || (u.location ?? "stores") !== "showroom") {
          throw new Error(`"${item.units![j].serialNumber}" is no longer available for sale`);
        }
      });
    });

    // For non-serialized items, check Showroom capacity up front so a
    // shortfall gets a clear, actionable message instead of allocateFifo's
    // generic "not enough stock" — staff need to know whether to transfer
    // from Stores or the product is genuinely out.
    const allocations = data.items.map((item, i) => {
      if (item.units && item.units.length > 0) {
        return allocateFromUnits(candidateBatchIds[i], batchSnaps[i], item.units);
      }
      const availableQty = batchSnaps[i].reduce((sum, snap) => {
        if (!snap.exists()) return sum;
        const b = snap.data() as { status: string; remainingQty: number };
        return b.status === "active" ? sum + b.remainingQty : sum;
      }, 0);
      if (availableQty < item.qty) {
        const productData = productDataById.get(item.productId);
        const storesStock = productData?.storesStock ?? 0;
        const hint = storesStock > 0 ? ` (${storesStock} more in Stores — transfer to Showroom first.)` : ".";
        throw new Error(
          `Not enough Showroom stock for "${item.productName}": requested ${item.qty}, only ${availableQty} in Showroom${hint}`
        );
      }
      return allocateFifo(candidateBatchIds[i], batchSnaps[i], item.qty, item.productName);
    });

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
        showroomStock: increment(-item.qty),
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
        performedByName: data.cashierName,
        location: "showroom",
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
      // Sales only ever draw from Showroom Stock, so a cancellation always
      // restores into Showroom too.
      tx.update(doc(db, "products", item.productId), {
        totalStock: increment(item.qty),
        showroomStock: increment(item.qty),
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
        performedByName: cancelledBy.name,
        location: "showroom",
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

// Admin Edit: non-financial fields only — customer contact details, note,
// and the payment method label. No line items, quantities, or prices —
// those mistakes still go through Reverse Bill + re-sell, not a rewrite of
// a completed sale's financial record.
const SALE_EDITABLE_FIELDS = ["customerName", "customerPhone", "customerEmail", "note", "paymentMethod"] as const;

export async function adminUpdateSale(
  saleId: string,
  patch: {
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    note?: string;
    paymentMethod?: "cash" | "card" | "transfer";
  },
  performedBy: { uid: string; name: string }
) {
  return runTransaction(db, async (tx) => {
    const ref = doc(db, "sales", saleId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Bill not found");
    const before = snap.data() as any;
    if (before.status === "cancelled") throw new Error("Cannot edit a cancelled bill");

    const changes = diffFields(before, patch, SALE_EDITABLE_FIELDS);
    if (changes.length > 0) tx.update(ref, { ...patch, updatedAt: serverTimestamp() });

    writeAuditLog(tx, {
      collectionName: "sales",
      docId: saleId,
      label: before.invoiceNo,
      changes,
      performedBy,
    });
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

// Admin Edit: corrects any job detail entered at intake (customer/device/
// fault/technician/cost fields). Deliberately excludes jobNo, status,
// repairCost, dateReturned, receivedById/Name, createdAt — status/repairCost
// changes stay on the updateJobStatus + statusHistory path above, since that
// already has its own dedicated audit trail. Every field here is safe to
// correct because Jobs never touch stock.
const JOB_EDITABLE_FIELDS = [
  "customerName", "customerCompany", "customerAddress", "customerCity", "customerPhone", "customerEmail",
  "deviceType", "deviceTypeOther", "brand", "model", "serialNo", "color",
  "faultDescription", "accessories", "accessoriesOther", "physicalCondition", "specialNotes",
  "assignedTechnicianId", "assignedTechnicianName",
  "estimatedCost", "advancePaid", "expectedDeliveryDate",
] as const;

export async function adminUpdateJob(
  jobId: string,
  patch: Partial<Record<(typeof JOB_EDITABLE_FIELDS)[number], any>>,
  performedBy: { uid: string; name: string }
) {
  return runTransaction(db, async (tx) => {
    const jobRef = doc(db, "jobs", jobId);
    const jobSnap = await tx.get(jobRef);
    if (!jobSnap.exists()) throw new Error("Job not found");
    const before = jobSnap.data() as any;

    const changes = diffFields(before, patch, JOB_EDITABLE_FIELDS);
    if (changes.length > 0) {
      tx.update(jobRef, { ...patch, updatedAt: serverTimestamp() });
    }
    writeAuditLog(tx, {
      collectionName: "jobs",
      docId: jobId,
      label: before.jobNo,
      changes,
      performedBy,
    });
  });
}

// ─── STOCK MOVEMENTS ──────────────────────────────────────────────────────────

export async function getStockMovements(opts?: {
  productId?: string;
  fromDate?: Date;
  toDate?: Date;
  referenceTypes?: string[];
}) {
  const constraints = [];
  if (opts?.productId) constraints.push(where("productId", "==", opts.productId));
  if (opts?.fromDate) constraints.push(where("createdAt", ">=", Timestamp.fromDate(opts.fromDate)));
  if (opts?.toDate) constraints.push(where("createdAt", "<=", Timestamp.fromDate(opts.toDate)));
  const snap = await getDocs(
    query(collection(db, "stock_movements"), ...constraints, orderBy("createdAt", "desc"))
  );
  let movements = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  if (opts?.referenceTypes && opts.referenceTypes.length > 0) {
    movements = movements.filter((m) => opts.referenceTypes!.includes(m.referenceType));
  }
  return movements;
}

// ─── AUDIT LOG (Admin Edit trail) ──────────────────────────────────────────────

export async function getAuditLog(opts?: { collectionName?: string; fromDate?: Date; toDate?: Date }) {
  const constraints = [];
  if (opts?.collectionName) constraints.push(where("collectionName", "==", opts.collectionName));
  if (opts?.fromDate) constraints.push(where("createdAt", ">=", Timestamp.fromDate(opts.fromDate)));
  if (opts?.toDate) constraints.push(where("createdAt", "<=", Timestamp.fromDate(opts.toDate)));
  const snap = await getDocs(query(collection(db, "auditLog"), ...constraints, orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─── GRN (GOODS RECEIVED NOTE) ────────────────────────────────────────────────
// Formal intake of newly purchased stock. Every line item always lands in
// Stores Stock — items are only sellable via POS once Transferred to Showroom.

export interface GrnItemData {
  productId: string;
  productName: string;
  sku: string;
  qty: number;
  costPrice: number;
  sellingPrice?: number | null;
  serials?: string[];
  note?: string;
}

export interface GrnData {
  supplierId?: string | null;
  supplierName?: string;
  receivedById: string;
  receivedByName: string;
  note?: string;
  items: GrnItemData[];
}

export async function createGrn(data: GrnData): Promise<{ grnId: string; grnNo: string; totalCost: number }> {
  const totalCost = data.items.reduce((sum, item) => sum + item.costPrice * (item.serials?.length ?? item.qty), 0);

  return runTransaction(db, async (tx) => {
    const counterRef = doc(db, "counters", "grn");
    const supplierRef = data.supplierId ? doc(db, "suppliers", data.supplierId) : null;
    const [counterDoc, supplierSnap] = await Promise.all([
      tx.get(counterRef),
      supplierRef ? tx.get(supplierRef) : Promise.resolve(null),
    ]);
    if (supplierRef && !supplierSnap!.exists()) throw new Error("Supplier no longer exists");

    const current = counterDoc.exists() ? (counterDoc.data().value as number) : 0;
    const next = current + 1;
    tx.set(counterRef, { value: next });
    const grnNo = `GRN-${String(next).padStart(5, "0")}`;

    const grnRef = doc(collection(db, "grns"));
    tx.set(grnRef, {
      supplierId: data.supplierId ?? null,
      supplierName: data.supplierName ?? "",
      totalCost,
      receivedById: data.receivedById,
      receivedByName: data.receivedByName,
      note: data.note ?? "",
      grnNo,
      createdAt: serverTimestamp(),
    });

    if (supplierRef) {
      const supplier = supplierSnap!.data() as { totalPayable?: number; amountPaid?: number };
      const totalPayableAfter = (supplier.totalPayable ?? 0) + totalCost;
      const amountPaid = supplier.amountPaid ?? 0;
      const balanceAfter = totalPayableAfter - amountPaid;
      tx.update(supplierRef, {
        totalPayable: totalPayableAfter,
        balance: balanceAfter,
        paymentStatus: computeSupplierPaymentStatus(totalPayableAfter, balanceAfter),
      });
    }

    for (const item of data.items) {
      const qty = item.serials?.length ?? item.qty;
      const batchRef = doc(collection(db, "products", item.productId, "batches"));
      tx.set(batchRef, {
        costPrice: item.costPrice,
        sellingPrice: item.sellingPrice ?? null,
        totalQty: qty,
        remainingQty: qty,
        supplierId: data.supplierId ?? null,
        note: item.note ?? `Received via ${grnNo}`,
        status: "active",
        location: "stores",
        receivedAt: serverTimestamp(),
      });

      for (const serialNumber of item.serials ?? []) {
        const unitRef = doc(collection(db, "products", item.productId, "units"));
        tx.set(unitRef, {
          serialNumber,
          batchId: batchRef.id,
          costPrice: item.costPrice,
          sellingPrice: item.sellingPrice ?? null,
          status: "in_stock",
          location: "stores",
          createdAt: serverTimestamp(),
        });
      }

      tx.update(doc(db, "products", item.productId), {
        totalStock: increment(qty),
        storesStock: increment(qty),
        lowStockAlerted: false,
      });

      const itemRef = doc(collection(db, "grns", grnRef.id, "grnItems"));
      tx.set(itemRef, {
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        qty,
        costPrice: item.costPrice,
        sellingPrice: item.sellingPrice ?? null,
        serials: item.serials ?? [],
        batchId: batchRef.id,
      });

      const mvRef = doc(collection(db, "stock_movements"));
      tx.set(mvRef, {
        productId: item.productId,
        type: "in",
        qty,
        referenceId: grnRef.id,
        referenceType: "grn",
        note: `Received via ${grnNo}`,
        performedBy: data.receivedById,
        performedByName: data.receivedByName,
        location: "stores",
        supplierName: data.supplierName ?? "",
        createdAt: serverTimestamp(),
      });
    }

    return { grnId: grnRef.id, grnNo, totalCost };
  });
}

export async function getGrns() {
  const snap = await getDocs(query(collection(db, "grns"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getGrn(id: string) {
  const grnDoc = await getDoc(doc(db, "grns", id));
  if (!grnDoc.exists()) return null;
  const items = await getDocs(collection(db, "grns", id, "grnItems"));
  return { id: grnDoc.id, ...grnDoc.data(), items: items.docs.map((d) => ({ id: d.id, ...d.data() })) };
}

// Admin Edit: supplier/note/per-item cost & selling price only — quantities
// and serials stay locked (stock already landed in Stores off this GRN, and
// may have already been Transferred or sold on). Deliberately does NOT
// recompute totalCost or the supplier's balance even when a cost price
// changes — retroactively correcting an already-posted, possibly already
// partially-paid balance is a materially bigger, riskier feature than a
// bookkeeping correction, so it's intentionally out of scope here.
const GRN_EDITABLE_FIELDS = ["supplierId", "supplierName", "note"] as const;
const GRN_ITEM_EDITABLE_FIELDS = ["costPrice", "sellingPrice"] as const;

export async function adminUpdateGrn(
  grnId: string,
  patch: {
    supplierId?: string | null;
    supplierName?: string;
    note?: string;
    items?: { id: string; costPrice?: number; sellingPrice?: number | null }[];
  },
  performedBy: { uid: string; name: string }
) {
  return runTransaction(db, async (tx) => {
    const grnRef = doc(db, "grns", grnId);
    const grnSnap = await tx.get(grnRef);
    if (!grnSnap.exists()) throw new Error("GRN not found");
    const before = grnSnap.data() as any;

    const itemRefs = (patch.items ?? []).map((i) => doc(db, "grns", grnId, "grnItems", i.id));
    const itemSnaps = await Promise.all(itemRefs.map((r) => tx.get(r)));

    const changes = diffFields(before, patch, GRN_EDITABLE_FIELDS);
    if (changes.length > 0) {
      tx.update(grnRef, {
        supplierId: patch.supplierId !== undefined ? patch.supplierId : before.supplierId,
        supplierName: patch.supplierName !== undefined ? patch.supplierName : before.supplierName,
        note: patch.note !== undefined ? patch.note : before.note,
        updatedAt: serverTimestamp(),
      });
    }

    (patch.items ?? []).forEach((itemPatch, i) => {
      const itemSnap = itemSnaps[i];
      if (!itemSnap.exists()) return;
      const itemBefore = itemSnap.data() as any;
      const itemChanges = diffFields(itemBefore, itemPatch, GRN_ITEM_EDITABLE_FIELDS);
      if (itemChanges.length > 0) {
        tx.update(itemRefs[i], {
          costPrice: itemPatch.costPrice ?? itemBefore.costPrice,
          sellingPrice: itemPatch.sellingPrice !== undefined ? itemPatch.sellingPrice : itemBefore.sellingPrice,
        });
        changes.push(...itemChanges.map((c) => ({ ...c, field: `items.${itemBefore.productName}.${c.field}` })));
      }
    });

    writeAuditLog(tx, {
      collectionName: "grns",
      docId: grnId,
      label: before.grnNo,
      changes,
      performedBy,
    });
  });
}

// ─── STOCK TRANSFER (Stores → Showroom) ───────────────────────────────────────

export interface StockTransferItemData {
  productId: string;
  productName: string;
  sku: string;
  qty: number;
  serialNumbers?: string[];
}

export interface StockTransferData {
  transferredById: string;
  transferredByName: string;
  note?: string;
  items: StockTransferItemData[];
}

export async function createStockTransfer(
  data: StockTransferData
): Promise<{ transferId: string; transferNo: string }> {
  // Non-transactional discovery first (transactions can only get() known doc
  // refs, not run queries) — same pattern as createSale.
  const candidateBatchIds = await Promise.all(
    data.items.map((item) =>
      item.serialNumbers && item.serialNumbers.length > 0
        ? Promise.resolve<string[]>([])
        : getCandidateBatchIds(item.productId, "stores")
    )
  );
  const resolvedUnits = await Promise.all(
    data.items.map((item) =>
      item.serialNumbers && item.serialNumbers.length > 0
        ? getUnitsBySerialNumbers(item.productId, item.serialNumbers)
        : Promise.resolve<any[]>([])
    )
  );

  return runTransaction(db, async (tx) => {
    // ---- Reads ----
    const counterRef = doc(db, "counters", "transfer");
    const counterDoc = await tx.get(counterRef);

    const batchSnaps: any[][] = await Promise.all(
      data.items.map((item, i) =>
        Promise.all(candidateBatchIds[i].map((id) => tx.get(doc(db, "products", item.productId, "batches", id))))
      )
    );
    const unitSnaps: any[][] = await Promise.all(
      data.items.map((item, i) =>
        Promise.all(resolvedUnits[i].map((u) => tx.get(doc(db, "products", item.productId, "units", u.id))))
      )
    );

    // Validate serialized items are still in Stores before writing anything.
    data.items.forEach((item, i) => {
      if (!item.serialNumbers || item.serialNumbers.length === 0) return;
      if (resolvedUnits[i].length !== item.serialNumbers.length) {
        throw new Error(`Some serial numbers for "${item.productName}" were not found.`);
      }
      unitSnaps[i].forEach((snap, j) => {
        const u = snap.exists() ? (snap.data() as { status: string; location?: StockLocation }) : null;
        if (!u || u.status !== "in_stock" || (u.location ?? "stores") !== "stores") {
          throw new Error(`"${resolvedUnits[i][j].serialNumber}" is not available in Stores.`);
        }
      });
    });

    // Non-serialized items: FIFO-consume Stores batches up front so a
    // shortfall aborts before any writes are issued.
    const allocations = data.items.map((item, i) => {
      if (item.serialNumbers && item.serialNumbers.length > 0) return null;
      return allocateFifo(candidateBatchIds[i], batchSnaps[i], item.qty, item.productName);
    });

    // ---- Writes ----
    const current = counterDoc.exists() ? (counterDoc.data().value as number) : 0;
    const next = current + 1;
    tx.set(counterRef, { value: next });
    const transferNo = `TRF-${String(next).padStart(5, "0")}`;

    const transferRef = doc(collection(db, "stockTransfers"));
    tx.set(transferRef, {
      transferredById: data.transferredById,
      transferredByName: data.transferredByName,
      note: data.note ?? "",
      transferNo,
      createdAt: serverTimestamp(),
    });

    data.items.forEach((item, i) => {
      tx.update(doc(db, "products", item.productId), {
        storesStock: increment(-item.qty),
        showroomStock: increment(item.qty),
      });

      let sourceBatchIds: string[] = [];
      let newBatchIds: string[] = [];

      if (item.serialNumbers && item.serialNumbers.length > 0) {
        for (const u of resolvedUnits[i]) {
          tx.update(doc(db, "products", item.productId, "units", u.id), { location: "showroom" });
        }
      } else {
        const allocation = allocations[i]!;
        sourceBatchIds = allocation.consumed.map((c) => c.batchId);
        const snapByBatchId = new Map(candidateBatchIds[i].map((id, idx) => [id, batchSnaps[i][idx]]));
        for (const c of allocation.consumed) {
          tx.update(doc(db, "products", item.productId, "batches", c.batchId), {
            remainingQty: increment(-c.qty),
            status: c.remainingAfter <= 0 ? "depleted" : "active",
          });
          // One new Showroom batch per consumed Stores batch — preserves
          // per-batch cost basis instead of blending FIFO cost across lots.
          const sourceSnap = snapByBatchId.get(c.batchId);
          const sourceData = sourceSnap?.data() as { costPrice: number; sellingPrice?: number | null } | undefined;
          const newBatchRef = doc(collection(db, "products", item.productId, "batches"));
          newBatchIds.push(newBatchRef.id);
          tx.set(newBatchRef, {
            costPrice: sourceData?.costPrice ?? 0,
            sellingPrice: sourceData?.sellingPrice ?? null,
            totalQty: c.qty,
            remainingQty: c.qty,
            note: `Transferred via ${transferNo}`,
            status: "active",
            location: "showroom",
            sourceBatchId: c.batchId,
            receivedAt: serverTimestamp(),
          });
        }
      }

      const itemRef = doc(collection(db, "stockTransfers", transferRef.id, "transferItems"));
      tx.set(itemRef, {
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        qty: item.qty,
        serialNumbers: item.serialNumbers ?? [],
        sourceBatchIds,
        newBatchIds,
      });

      const mvRef = doc(collection(db, "stock_movements"));
      tx.set(mvRef, {
        productId: item.productId,
        type: "transfer",
        qty: item.qty,
        referenceId: transferRef.id,
        referenceType: "transfer",
        note: `Transferred via ${transferNo}`,
        performedBy: data.transferredById,
        performedByName: data.transferredByName,
        fromLocation: "stores",
        toLocation: "showroom",
        createdAt: serverTimestamp(),
      });
    });

    return { transferId: transferRef.id, transferNo };
  });
}

export async function getStockTransfers() {
  const snap = await getDocs(query(collection(db, "stockTransfers"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getStockTransfer(id: string) {
  const transferDoc = await getDoc(doc(db, "stockTransfers", id));
  if (!transferDoc.exists()) return null;
  const items = await getDocs(collection(db, "stockTransfers", id, "transferItems"));
  return {
    id: transferDoc.id,
    ...transferDoc.data(),
    items: items.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

// Admin Edit: note only — quantities/serials stay locked, since correcting
// them after the fact would mean reconciling stock deltas across records
// that may have already moved on (sold, re-transferred, etc). A real
// quantity mistake gets corrected with a new Transfer, not by rewriting this one.
const STOCK_TRANSFER_EDITABLE_FIELDS = ["note"] as const;

export async function adminUpdateStockTransfer(
  transferId: string,
  patch: { note?: string },
  performedBy: { uid: string; name: string }
) {
  return runTransaction(db, async (tx) => {
    const ref = doc(db, "stockTransfers", transferId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Stock Transfer not found");
    const before = snap.data() as any;

    const changes = diffFields(before, patch, STOCK_TRANSFER_EDITABLE_FIELDS);
    if (changes.length > 0) tx.update(ref, { note: patch.note ?? before.note, updatedAt: serverTimestamp() });

    writeAuditLog(tx, {
      collectionName: "stockTransfers",
      docId: transferId,
      label: before.transferNo,
      changes,
      performedBy,
    });
  });
}

// ─── STOCK OUT (manual issuance) ───────────────────────────────────────────────

export interface StockOutItemData {
  productId: string;
  productName: string;
  sku: string;
  qty: number;
  serialNumbers?: string[];
}

export interface StockOutData {
  location: StockLocation;
  issuedById: string;
  issuedByName: string;
  recipient: string;
  reason: StockMovementReason;
  reasonDetail?: string;
  jobId?: string | null;
  jobNo?: string | null;
  note?: string;
  items: StockOutItemData[];
}

export async function createStockOut(data: StockOutData): Promise<{ stockOutId: string; stockOutNo: string }> {
  const candidateBatchIds = await Promise.all(
    data.items.map((item) =>
      item.serialNumbers && item.serialNumbers.length > 0
        ? Promise.resolve<string[]>([])
        : getCandidateBatchIds(item.productId, data.location)
    )
  );
  const resolvedUnits = await Promise.all(
    data.items.map((item) =>
      item.serialNumbers && item.serialNumbers.length > 0
        ? getUnitsBySerialNumbers(item.productId, item.serialNumbers)
        : Promise.resolve<any[]>([])
    )
  );

  return runTransaction(db, async (tx) => {
    const counterRef = doc(db, "counters", "stockOut");
    const counterDoc = await tx.get(counterRef);

    const batchSnaps: any[][] = await Promise.all(
      data.items.map((item, i) =>
        Promise.all(candidateBatchIds[i].map((id) => tx.get(doc(db, "products", item.productId, "batches", id))))
      )
    );
    const unitSnaps: any[][] = await Promise.all(
      data.items.map((item, i) =>
        Promise.all(resolvedUnits[i].map((u) => tx.get(doc(db, "products", item.productId, "units", u.id))))
      )
    );

    data.items.forEach((item, i) => {
      if (!item.serialNumbers || item.serialNumbers.length === 0) return;
      if (resolvedUnits[i].length !== item.serialNumbers.length) {
        throw new Error(`Some serial numbers for "${item.productName}" were not found.`);
      }
      unitSnaps[i].forEach((snap, j) => {
        const u = snap.exists() ? (snap.data() as { status: string; location?: StockLocation }) : null;
        if (!u || u.status !== "in_stock" || (u.location ?? "stores") !== data.location) {
          throw new Error(`"${resolvedUnits[i][j].serialNumber}" is not available in ${data.location === "stores" ? "Stores" : "Showroom"}.`);
        }
      });
    });

    const allocations = data.items.map((item, i) => {
      if (item.serialNumbers && item.serialNumbers.length > 0) return null;
      return allocateFifo(candidateBatchIds[i], batchSnaps[i], item.qty, item.productName);
    });

    const current = counterDoc.exists() ? (counterDoc.data().value as number) : 0;
    const next = current + 1;
    tx.set(counterRef, { value: next });
    const stockOutNo = `SO-${String(next).padStart(5, "0")}`;

    const stockOutRef = doc(collection(db, "stockOuts"));
    tx.set(stockOutRef, {
      location: data.location,
      issuedById: data.issuedById,
      issuedByName: data.issuedByName,
      recipient: data.recipient,
      reason: data.reason,
      reasonDetail: data.reasonDetail ?? "",
      jobId: data.jobId ?? null,
      jobNo: data.jobNo ?? null,
      note: data.note ?? "",
      stockOutNo,
      createdAt: serverTimestamp(),
    });

    data.items.forEach((item, i) => {
      tx.update(doc(db, "products", item.productId), {
        totalStock: increment(-item.qty),
        [data.location === "showroom" ? "showroomStock" : "storesStock"]: increment(-item.qty),
      });

      let costPrice = 0;

      if (item.serialNumbers && item.serialNumbers.length > 0) {
        for (const u of resolvedUnits[i]) {
          costPrice = u.costPrice ?? costPrice;
          tx.update(doc(db, "products", item.productId, "units", u.id), {
            status: "issued",
            stockOutId: stockOutRef.id,
            issuedAt: serverTimestamp(),
          });
        }
      } else {
        const allocation = allocations[i]!;
        costPrice = allocation.costPrice;
        for (const c of allocation.consumed) {
          tx.update(doc(db, "products", item.productId, "batches", c.batchId), {
            remainingQty: increment(-c.qty),
            status: c.remainingAfter <= 0 ? "depleted" : "active",
          });
        }
      }

      const itemRef = doc(collection(db, "stockOuts", stockOutRef.id, "stockOutItems"));
      tx.set(itemRef, {
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        qty: item.qty,
        serialNumbers: item.serialNumbers ?? [],
        costPrice,
      });

      const mvRef = doc(collection(db, "stock_movements"));
      tx.set(mvRef, {
        productId: item.productId,
        type: "out",
        qty: -item.qty,
        referenceId: stockOutRef.id,
        referenceType: "stock_out",
        note: `Issued via ${stockOutNo}`,
        performedBy: data.issuedById,
        performedByName: data.issuedByName,
        location: data.location,
        recipient: data.recipient,
        reason: data.reason,
        reasonDetail: data.reasonDetail ?? "",
        jobId: data.jobId ?? null,
        jobNo: data.jobNo ?? null,
        createdAt: serverTimestamp(),
      });
    });

    return { stockOutId: stockOutRef.id, stockOutNo };
  });
}

export async function getStockOuts() {
  const snap = await getDocs(query(collection(db, "stockOuts"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getStockOut(id: string) {
  const stockOutDoc = await getDoc(doc(db, "stockOuts", id));
  if (!stockOutDoc.exists()) return null;
  const items = await getDocs(collection(db, "stockOuts", id, "stockOutItems"));
  return {
    id: stockOutDoc.id,
    ...stockOutDoc.data(),
    items: items.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

// Admin Edit: recipient/reason/job-link/note only — quantities/serials
// already deducted from live stock stay locked, same rationale as GRN/Transfer.
const STOCK_OUT_EDITABLE_FIELDS = ["recipient", "reason", "reasonDetail", "note", "jobId", "jobNo"] as const;

export async function adminUpdateStockOut(
  stockOutId: string,
  patch: {
    recipient?: string;
    reason?: StockMovementReason;
    reasonDetail?: string;
    note?: string;
    jobId?: string | null;
    jobNo?: string | null;
  },
  performedBy: { uid: string; name: string }
) {
  return runTransaction(db, async (tx) => {
    const ref = doc(db, "stockOuts", stockOutId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Stock Out not found");
    const before = snap.data() as any;

    const changes = diffFields(before, patch, STOCK_OUT_EDITABLE_FIELDS);
    if (changes.length > 0) tx.update(ref, { ...patch, updatedAt: serverTimestamp() });

    writeAuditLog(tx, {
      collectionName: "stockOuts",
      docId: stockOutId,
      label: before.stockOutNo,
      changes,
      performedBy,
    });
  });
}

// ─── SUPPLIERS ────────────────────────────────────────────────────────────────

export async function getSuppliers() {
  const snap = await getDocs(query(collection(db, "suppliers"), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addSupplier(data: { name: string; phone: string; email?: string; address?: string }) {
  return addDoc(collection(db, "suppliers"), {
    ...data,
    totalPayable: 0,
    amountPaid: 0,
    balance: 0,
    paymentStatus: "paid",
    createdAt: serverTimestamp(),
  });
}

// Only ever touches contact fields — the balance fields (totalPayable/
// amountPaid/balance/paymentStatus) are exclusively written by createGrn and
// createSupplierPayment, never by this function.
export async function updateSupplier(id: string, data: { name: string; phone: string; email?: string; address?: string }) {
  return updateDoc(doc(db, "suppliers", id), { ...data, updatedAt: serverTimestamp() });
}

// "Paid" if nothing owed (or nothing ever posted), "Outstanding" if nothing
// paid at all yet, "Partial" in between.
function computeSupplierPaymentStatus(totalPayable: number, balance: number): SupplierPaymentStatus {
  if (balance <= 0) return "paid";
  if (balance >= totalPayable) return "outstanding";
  return "partial";
}

export interface SupplierPaymentData {
  supplierId: string;
  amount: number;
  method: SupplierPaymentMethod;
  reference?: string;
  note?: string;
  paidById: string;
  paidByName: string;
}

export async function createSupplierPayment(
  data: SupplierPaymentData
): Promise<{ paymentId: string; paymentNo: string }> {
  if (data.amount <= 0) throw new Error("Payment amount must be greater than zero");
  return runTransaction(db, async (tx) => {
    const supplierRef = doc(db, "suppliers", data.supplierId);
    const counterRef = doc(db, "counters", "supplierPayment");
    const [supplierSnap, counterDoc] = await Promise.all([tx.get(supplierRef), tx.get(counterRef)]);
    if (!supplierSnap.exists()) throw new Error("Supplier not found");
    const supplier = supplierSnap.data() as { name: string; totalPayable?: number; amountPaid?: number };
    const totalPayable = supplier.totalPayable ?? 0;
    const balanceBefore = totalPayable - (supplier.amountPaid ?? 0);
    if (data.amount > balanceBefore) {
      throw new Error(
        `Payment of Rs. ${data.amount.toLocaleString()} exceeds the outstanding balance of Rs. ${balanceBefore.toLocaleString()}`
      );
    }
    const amountPaidAfter = (supplier.amountPaid ?? 0) + data.amount;
    const balanceAfter = totalPayable - amountPaidAfter;

    const current = counterDoc.exists() ? (counterDoc.data().value as number) : 0;
    const next = current + 1;
    tx.set(counterRef, { value: next });
    const paymentNo = `PAY-${String(next).padStart(5, "0")}`;

    const paymentRef = doc(collection(db, "supplierPayments"));
    tx.set(paymentRef, {
      paymentNo,
      supplierId: data.supplierId,
      supplierName: supplier.name,
      amount: data.amount,
      method: data.method,
      reference: data.reference ?? "",
      note: data.note ?? "",
      balanceBefore,
      balanceAfter,
      paidById: data.paidById,
      paidByName: data.paidByName,
      createdAt: serverTimestamp(),
    });
    tx.update(supplierRef, {
      amountPaid: amountPaidAfter,
      balance: balanceAfter,
      paymentStatus: computeSupplierPaymentStatus(totalPayable, balanceAfter),
      lastPaymentAt: serverTimestamp(),
    });

    return { paymentId: paymentRef.id, paymentNo };
  });
}

export async function getSupplierPayments(opts?: { supplierId?: string; fromDate?: Date; toDate?: Date }) {
  const constraints = [];
  if (opts?.supplierId) constraints.push(where("supplierId", "==", opts.supplierId));
  if (opts?.fromDate) constraints.push(where("createdAt", ">=", Timestamp.fromDate(opts.fromDate)));
  if (opts?.toDate) constraints.push(where("createdAt", "<=", Timestamp.fromDate(opts.toDate)));
  const snap = await getDocs(query(collection(db, "supplierPayments"), ...constraints, orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function markSupplierStatementSent(supplierId: string) {
  return updateDoc(doc(db, "suppliers", supplierId), { lastStatementSentAt: serverTimestamp() });
}

// Admin Edit: corrects a mistyped payment. Unlike every other adminUpdate*
// function, this one DOES recompute a running total — a wrong payment amount
// directly misstates what the supplier is owed, so the correction has to
// flow through to Supplier.amountPaid/balance/paymentStatus, not just the
// payment doc itself.
const SUPPLIER_PAYMENT_EDITABLE_FIELDS = ["amount", "method", "reference", "note"] as const;

export async function adminUpdateSupplierPayment(
  paymentId: string,
  patch: { amount?: number; method?: SupplierPaymentMethod; reference?: string; note?: string },
  performedBy: { uid: string; name: string }
) {
  return runTransaction(db, async (tx) => {
    const paymentRef = doc(db, "supplierPayments", paymentId);
    const paymentSnap = await tx.get(paymentRef);
    if (!paymentSnap.exists()) throw new Error("Payment not found");
    const before = paymentSnap.data() as any;
    const supplierRef = doc(db, "suppliers", before.supplierId);
    const supplierSnap = await tx.get(supplierRef);
    if (!supplierSnap.exists()) throw new Error("Supplier not found");
    const supplier = supplierSnap.data() as any;

    const changes = diffFields(before, patch, SUPPLIER_PAYMENT_EDITABLE_FIELDS);
    const amountDelta = (patch.amount ?? before.amount) - before.amount;

    if (amountDelta !== 0) {
      const totalPayable = supplier.totalPayable ?? 0;
      const amountPaidAfter = (supplier.amountPaid ?? 0) + amountDelta;
      const balanceAfter = totalPayable - amountPaidAfter;
      tx.update(supplierRef, {
        amountPaid: amountPaidAfter,
        balance: balanceAfter,
        paymentStatus: computeSupplierPaymentStatus(totalPayable, balanceAfter),
      });
      tx.update(paymentRef, {
        amount: patch.amount ?? before.amount,
        method: patch.method ?? before.method,
        reference: patch.reference ?? before.reference,
        note: patch.note ?? before.note,
        balanceAfter,
        updatedAt: serverTimestamp(),
      });
    } else if (changes.length > 0) {
      tx.update(paymentRef, { ...patch, updatedAt: serverTimestamp() });
    }

    writeAuditLog(tx, {
      collectionName: "supplierPayments",
      docId: paymentId,
      label: before.paymentNo,
      changes,
      performedBy,
    });
  });
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

// ─── STOCK LOCATION MIGRATION (one-time) ──────────────────────────────────────
// Introducing the Stores/Showroom split requires every pre-existing batch and
// unit to be tagged with a location, and every product to gain storesStock/
// showroomStock aggregates. Everything becomes Stores Stock — nothing is
// sellable via POS until it's Transferred to Showroom.

export async function getStockLocationMigrationStatus(): Promise<{
  done: boolean;
  migratedAt?: any;
  migratedByName?: string;
} | null> {
  const snap = await getDoc(doc(db, "migrations", "stockLocation"));
  return snap.exists() ? (snap.data() as any) : null;
}

export async function migrateStockToLocations(
  migratedBy: { uid: string; name: string }
): Promise<{ productsTouched: number; batchesTouched: number; unitsTouched: number }> {
  const productsSnap = await getDocs(collection(db, "products"));
  let productsTouched = 0;
  let batchesTouched = 0;
  let unitsTouched = 0;

  for (const productDoc of productsSnap.docs) {
    const product = productDoc.data() as { totalStock?: number; storesStock?: number; showroomStock?: number };
    const [batchesSnap, unitsSnap] = await Promise.all([
      getDocs(collection(db, "products", productDoc.id, "batches")),
      getDocs(collection(db, "products", productDoc.id, "units")),
    ]);

    // Only touch documents that don't already have a location — safe to
    // re-run after an interruption without redoing already-migrated work.
    const pending: { ref: any; data: Record<string, any> }[] = [];
    for (const b of batchesSnap.docs) {
      if (!b.data().location) {
        pending.push({ ref: b.ref, data: { location: "stores" } });
        batchesTouched++;
      }
    }
    for (const u of unitsSnap.docs) {
      if (!u.data().location) {
        pending.push({ ref: u.ref, data: { location: "stores" } });
        unitsTouched++;
      }
    }
    if (product.storesStock === undefined || product.showroomStock === undefined) {
      pending.push({ ref: productDoc.ref, data: { storesStock: product.totalStock ?? 0, showroomStock: 0 } });
    }

    if (pending.length === 0) continue;
    for (let i = 0; i < pending.length; i += 450) {
      const wb = writeBatch(db);
      pending.slice(i, i + 450).forEach((p) => wb.update(p.ref, p.data));
      await wb.commit();
    }
    productsTouched++;
  }

  await setDoc(doc(db, "migrations", "stockLocation"), {
    done: true,
    migratedAt: serverTimestamp(),
    migratedById: migratedBy.uid,
    migratedByName: migratedBy.name,
  });

  return { productsTouched, batchesTouched, unitsTouched };
}
