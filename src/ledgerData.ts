import { INCOME_START } from "./format";
import type { Assignments, Cycle, FixedItem, Income, ItemSet } from "./schedule";
import type { LedgerSnapshot } from "./snapshot";

export const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

export const CYCLE_VALUES: Cycle[] = ["daily", "weekly", "monthly", "quarterly", "yearly"];

/** Old combined labels → current single labels */
export const CATEGORY_REMAP: Record<string, string> = {
  소프트웨어: "구독",
  "대출·이자": "대출",
  "저축·투자": "저축",
  "운동·취미": "운동",
  "회비·경조사": "회비",
  "가족·용돈": "용돈",
};

export const DEFAULT_SNAPSHOT: LedgerSnapshot = {
  version: 3,
  items: [],
  assignments: {},
  sets: [],
  income: { base: 0, months: {} },
};

export type MutableLedger = {
  version: number;
  items: FixedItem[];
  assignments: Assignments;
  sets: ItemSet[];
  income: Income;
};

export function monthKeysThrough(end = new Date(), start = INCOME_START): string[] {
  const keys: string[] = [];
  let y = start.year;
  let m = start.month;
  const endY = end.getFullYear();
  const endM = end.getMonth() + 1;
  while (y < endY || (y === endY && m <= endM)) {
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    if (keys.length > 240) break;
  }
  return keys;
}

export function normalizeAssignments(raw: unknown): Assignments {
  const out: Assignments = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!MONTH_KEY.test(key) || !Array.isArray(value)) continue;
    const ids = [...new Set(value.map(String).filter(Boolean))];
    if (ids.length) out[key] = ids;
  }
  return out;
}

export function remapCategory(category: unknown): string {
  const raw = String(category ?? "").trim() || "기타";
  return CATEGORY_REMAP[raw] ?? raw;
}

export function normalizeIncome(raw: unknown): Income {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const base = Math.max(0, Math.round(Number(src.base) || 0));
  const months: Record<string, number> = {};
  const monthSrc =
    src.months && typeof src.months === "object" && !Array.isArray(src.months)
      ? (src.months as Record<string, unknown>)
      : {};
  for (const [key, value] of Object.entries(monthSrc)) {
    const n = Math.round(Number(value));
    if (MONTH_KEY.test(key) && Number.isFinite(n) && n >= 0) months[key] = n;
  }
  return { base, months };
}

export function scrubAssignments(assignments: Assignments, id: string): void {
  for (const key of Object.keys(assignments)) {
    assignments[key] = assignments[key].filter((x) => x !== id);
    if (!assignments[key].length) delete assignments[key];
  }
}

/** Drop items not referenced by any set (and scrub their month assignments). */
export function pruneOrphanItems(data: Pick<MutableLedger, "items" | "sets" | "assignments">): void {
  if (!(data.sets || []).length) return;
  const used = new Set<string>();
  for (const s of data.sets || []) {
    for (const id of s.itemIds || []) used.add(id);
  }
  const kept: FixedItem[] = [];
  for (const it of data.items) {
    if (used.has(it.id)) kept.push(it);
    else scrubAssignments(data.assignments, it.id);
  }
  data.items = kept;
}

export function monthsWhereFullyApplied(assignments: Assignments, itemIds: string[]): string[] {
  const ids = [...new Set((itemIds || []).map(String).filter(Boolean))];
  if (!ids.length) return [];
  const keys: string[] = [];
  for (const [key, list] of Object.entries(assignments || {})) {
    if (!MONTH_KEY.test(key) || !Array.isArray(list)) continue;
    const bucket = new Set(list);
    if (ids.every((id) => bucket.has(id))) keys.push(key);
  }
  return keys;
}

/** Keep previously applied months in sync when a set's item list changes. */
export function reapplySetMonths(
  data: Pick<MutableLedger, "sets" | "assignments">,
  oldIds: string[],
  newIds: string[]
): void {
  const applied = monthsWhereFullyApplied(data.assignments, oldIds);
  if (!applied.length) return;

  const oldSet = new Set(oldIds);
  const newSet = new Set(newIds);
  const removed = [...oldSet].filter((id) => !newSet.has(id));

  for (const key of applied) {
    const bucket = new Set(data.assignments[key] ?? []);
    for (const id of newIds) bucket.add(id);
    for (const id of removed) {
      const stillInSomeSet = (data.sets || []).some((s) => (s.itemIds || []).includes(id));
      if (!stillInSomeSet) bucket.delete(id);
    }
    if (bucket.size) data.assignments[key] = [...bucket];
    else delete data.assignments[key];
  }
}

export function toggleIdsInMonth(assignments: Assignments, monthKey: string, ids: string[]): void {
  if (!MONTH_KEY.test(monthKey)) throw new Error("invalid month");
  const current = new Set(assignments[monthKey] ?? []);
  const allOn = ids.length > 0 && ids.every((id) => current.has(id));
  if (allOn) ids.forEach((id) => current.delete(id));
  else ids.forEach((id) => current.add(id));
  if (current.size) assignments[monthKey] = [...current];
  else delete assignments[monthKey];
}

export function setNameTaken(sets: ItemSet[], name: string, excludeId?: string): boolean {
  const label = String(name || "").trim().toLowerCase();
  if (!label) return false;
  return (sets || []).some(
    (s) => s.id !== excludeId && String(s.name || "").trim().toLowerCase() === label
  );
}

/**
 * Normalize/migrate a raw backup into a ledger document.
 * Throws if `items` is missing (same gate as isLedgerSnapshot).
 */
export function migrateSnapshot(raw: unknown): MutableLedger {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("invalid backup");
  const data = structuredClone(raw) as Record<string, unknown>;
  if (!Array.isArray(data.items)) throw new Error("invalid backup");

  const hadAssignments = data.assignments && typeof data.assignments === "object";
  data.assignments = normalizeAssignments(data.assignments);

  const items = data.items as FixedItem[];
  const assignments = data.assignments as Assignments;

  // v1 data: items existed without month assignment → seed through current month
  if (!hadAssignments && items.length > 0 && Object.keys(assignments).length === 0) {
    const ids = items.filter((it) => it.active !== false).map((it) => it.id).filter(Boolean);
    for (const key of monthKeysThrough()) assignments[key] = [...ids];
  }

  let categoriesTouched = false;
  for (const it of items) {
    const next = remapCategory(it.category);
    if (next !== it.category) {
      it.category = next;
      categoriesTouched = true;
    }
  }
  if (categoriesTouched || Number(data.version) < 3) data.version = 3;

  data.income = normalizeIncome(data.income);
  if (!Array.isArray(data.sets)) data.sets = [];

  return {
    version: Math.max(3, Number(data.version) || 3),
    items,
    assignments,
    sets: data.sets as ItemSet[],
    income: data.income as Income,
  };
}
