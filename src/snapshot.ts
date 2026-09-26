import type { Assignments, FixedItem, Income, ItemSet } from "./schedule";

/** Full on-disk ledger document (export/import shape). */
export type LedgerSnapshot = {
  version: number;
  items: FixedItem[];
  assignments: Assignments;
  sets: ItemSet[];
  income: Income;
};

export function isLedgerSnapshot(raw: unknown): raw is LedgerSnapshot {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.items)) return false;
  if (o.assignments !== undefined && (typeof o.assignments !== "object" || Array.isArray(o.assignments))) {
    return false;
  }
  if (o.sets !== undefined && !Array.isArray(o.sets)) return false;
  if (o.income !== undefined && (typeof o.income !== "object" || Array.isArray(o.income))) return false;
  return true;
}
