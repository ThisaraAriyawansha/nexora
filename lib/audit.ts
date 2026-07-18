import { collection, doc, serverTimestamp, Transaction } from "firebase/firestore";
import { db } from "./firebase";

export interface FieldChange {
  field: string;
  before: any;
  after: any;
}

// Shallow diff restricted to an explicit allowlist — callers only ever pass
// the fields they intend to let an Admin edit, so a locked field (quantities,
// serials, financial totals) can never accidentally slip into a change set.
export function diffFields(
  before: Record<string, any>,
  patch: Record<string, any>,
  allowedFields: readonly string[]
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of allowedFields) {
    if (!(field in patch)) continue;
    const b = before[field] ?? null;
    const a = patch[field] ?? null;
    if (JSON.stringify(b) !== JSON.stringify(a)) changes.push({ field, before: b, after: a });
  }
  return changes;
}

// Writes one auditLog doc inside the caller's own transaction — same "log
// write happens in the same tx as the primary write" convention already used
// by updateBatch's stock_movements write and updateJobStatus's statusHistory
// write. No-ops if nothing actually changed, so submitting an edit form with
// no real edits doesn't create an empty audit entry.
export function writeAuditLog(
  tx: Transaction,
  params: {
    collectionName: string;
    docId: string;
    label: string;
    changes: FieldChange[];
    performedBy: { uid: string; name: string };
  }
): boolean {
  if (params.changes.length === 0) return false;
  const ref = doc(collection(db, "auditLog"));
  tx.set(ref, {
    collectionName: params.collectionName,
    docId: params.docId,
    label: params.label,
    changes: params.changes,
    performedById: params.performedBy.uid,
    performedByName: params.performedBy.name,
    createdAt: serverTimestamp(),
  });
  return true;
}
