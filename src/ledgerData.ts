import { INCOME_START } from "./format";
import type { Assignments, Cycle, FixedItem, Income, ItemSet } from "./schedule";
import { isLedgerSnapshot, type LedgerSnapshot } from "./snapshot";

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

/** Remove items that left every set among `releasedIds`. Unrelated drafts stay. */
export function dropReleasedOrphans(
  data: Pick<MutableLedger, "items" | "sets" | "assignments">,
  releasedIds: string[]
): void {
  const used = new Set<string>();
  for (const s of data.sets || []) {
    for (const id of s.itemIds || []) used.add(id);
  }
  const drop = new Set(releasedIds.map(String).filter((id) => id && !used.has(id)));
  if (!drop.size) return;
  data.items = data.items.filter((it) => {
    if (!drop.has(it.id)) return true;
    scrubAssignments(data.assignments, it.id);
    return false;
  });
}

function clampInt(v: unknown, min: number, max: number, fallback: number) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Clamp cycle/day/category for persistence (store + browser mock). */
export function normalizeItem(row: FixedItem & { active?: boolean }): FixedItem {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? "").trim(),
    amount: Number(row.amount) || 0,
    cycle: CYCLE_VALUES.includes(row.cycle) ? row.cycle : "monthly",
    day: clampInt(row.day, 1, 31, 1),
    weekday: clampInt(row.weekday, 0, 6, 1),
    month: clampInt(row.month, 1, 12, 1),
    category: remapCategory(row.category),
    note: String(row.note ?? "").trim(),
  };
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

/**
 * True when some set (optionally excluding one) includes `id` and is fully present in `bucket`.
 * Shared by month toggle / set reapply so shared membership does not leave stray assignments.
 */
export function keptByFullyAppliedSet(
  sets: ItemSet[],
  bucket: Set<string>,
  id: string,
  excludeSetId?: string
): boolean {
  return (sets || []).some((s) => {
    if (excludeSetId && s.id === excludeSetId) return false;
    const sIds = (s.itemIds || []).filter(Boolean);
    if (!sIds.length || !sIds.includes(id)) return false;
    return sIds.every((sid) => bucket.has(sid));
  });
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
      if (!keptByFullyAppliedSet(data.sets || [], bucket, id)) bucket.delete(id);
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

/**
 * Toggle a set onto/off a month. When turning off, keep an id if another fully-applied
 * set on that month still needs it (shared membership / import edge case).
 */
export function toggleSetMonthIds(
  assignments: Assignments,
  sets: ItemSet[],
  setId: string,
  monthKey: string,
  ids: string[]
): void {
  if (!MONTH_KEY.test(monthKey)) throw new Error("invalid month");
  const current = new Set(assignments[monthKey] ?? []);
  const allOn = ids.length > 0 && ids.every((id) => current.has(id));
  if (allOn) {
    for (const id of ids) {
      if (!keptByFullyAppliedSet(sets, current, id, setId)) current.delete(id);
    }
  } else {
    ids.forEach((id) => current.add(id));
  }
  if (current.size) assignments[monthKey] = [...current];
  else delete assignments[monthKey];
}

/**
 * Items must live in a set to be editable on the Ledger bench.
 * Wrap any set-less ids into a new set (import / crash drafts / legacy).
 */
export function ensureOrphansInSet(data: Pick<MutableLedger, "items" | "sets">): void {
  if (!Array.isArray(data.sets)) data.sets = [];
  const used = new Set(data.sets.flatMap((s) => s.itemIds || []));
  const orphans = data.items.map((it) => it.id).filter((id) => id && !used.has(id));
  if (!orphans.length) return;

  const base = data.sets.length === 0 ? "기본" : "미저장";
  let name = base;
  if (setNameTaken(data.sets, name)) {
    let n = 2;
    while (setNameTaken(data.sets, `${base} ${n}`)) n += 1;
    name = `${base} ${n}`;
  }

  data.sets.push({
    id: crypto.randomUUID(),
    name,
    itemIds: orphans,
    createdAt: new Date().toISOString(),
  });
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
 * Throws if snapshot shape is invalid (same gate as isLedgerSnapshot).
 */
export function migrateSnapshot(raw: unknown): MutableLedger {
  if (!isLedgerSnapshot(raw)) throw new Error("invalid backup");
  const data = structuredClone(raw) as LedgerSnapshot & Record<string, unknown>;

  const hadAssignments = data.assignments != null && typeof data.assignments === "object";
  const assignments = normalizeAssignments(data.assignments);

  const rawItems = Array.isArray(data.items) ? data.items : [];

  // v1 data: items existed without month assignment → seed through current month
  if (!hadAssignments && rawItems.length > 0 && Object.keys(assignments).length === 0) {
    const ids = rawItems.map((it) => String(it.id || "")).filter(Boolean);
    for (const key of monthKeysThrough()) assignments[key] = [...ids];
  }

  const items = rawItems.map((it) =>
    normalizeItem({
      id: String(it.id || ""),
      name: String(it.name ?? ""),
      amount: Number(it.amount) || 0,
      cycle: it.cycle,
      day: Number(it.day) || 1,
      weekday: Number(it.weekday) || 1,
      month: Number(it.month) || 1,
      category: it.category,
      note: String(it.note ?? ""),
    })
  );

  return {
    version: Math.max(3, Number(data.version) || 3),
    items,
    assignments,
    sets: Array.isArray(data.sets) ? data.sets : [],
    income: normalizeIncome(data.income),
  };
}
