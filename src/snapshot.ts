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
  return Array.isArray(o.items);
}
