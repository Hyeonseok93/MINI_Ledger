import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Cycle, FixedItem, Income, ItemSet } from "../src/schedule";
import {
  CYCLE_VALUES,
  DEFAULT_SNAPSHOT,
  MONTH_KEY,
  type MutableLedger,
  migrateSnapshot,
  normalizeAssignments,
  normalizeIncome,
  pruneOrphanItems,
  reapplySetMonths,
  remapCategory,
  scrubAssignments,
  setNameTaken,
  toggleIdsInMonth,
} from "../src/ledgerData";

let storeDir = "";
let filePath = "";

type Draft = Partial<FixedItem> & {
  name?: string;
  amount?: number;
};

function ensure() {
  if (!fs.existsSync(storeDir)) fs.mkdirSync(storeDir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(DEFAULT_SNAPSHOT, null, 2), "utf8");
  }
}

function read(): MutableLedger {
  ensure();
  try {
    return migrateSnapshot(JSON.parse(fs.readFileSync(filePath, "utf8")));
  } catch {
    return structuredClone(DEFAULT_SNAPSHOT);
  }
}

function write(data: MutableLedger) {
  ensure();
  data.version = Math.max(3, Number(data.version) || 3);
  data.assignments = normalizeAssignments(data.assignments);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

export function init(userData: string) {
  storeDir = path.join(userData, "store");
  filePath = path.join(storeDir, "ledger.json");
  ensure();
  write(read());
}

export function getStoreDir() {
  return storeDir;
}

function clampInt(v: unknown, min: number, max: number, fallback: number) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalize(row: FixedItem): FixedItem {
  return {
    ...row,
    cycle: CYCLE_VALUES.includes(row.cycle) ? row.cycle : "monthly",
    day: clampInt(row.day, 1, 31, 1),
    weekday: clampInt(row.weekday, 0, 6, 1),
    month: clampInt(row.month, 1, 12, 1),
    category: remapCategory(row.category),
  };
}

export function getAll(): FixedItem[] {
  return read().items.map(normalize);
}

export function upsert(item: Draft): FixedItem {
  const data = read();
  const idx = item.id ? data.items.findIndex((x) => x.id === item.id) : -1;
  if (item.id && idx < 0) throw new Error("not found");
  const prev: FixedItem =
    idx >= 0
      ? data.items[idx]
      : {
          id: crypto.randomUUID(),
          name: "",
          amount: 0,
          cycle: "monthly",
          day: 1,
          weekday: 1,
          month: 1,
          category: "기타",
          note: "",
          active: true,
        };

  const row = normalize({
    ...prev,
    name: String(item.name ?? prev.name ?? "").trim(),
    amount: Number(item.amount ?? prev.amount) || 0,
    cycle: (item.cycle ?? prev.cycle) as Cycle,
    day: Number(item.day ?? prev.day),
    weekday: Number(item.weekday ?? prev.weekday),
    month: Number(item.month ?? prev.month),
    category: remapCategory(String(item.category ?? prev.category ?? "기타").trim() || "기타"),
    note: String(item.note ?? prev.note ?? "").trim(),
    active: item.active !== undefined ? !!item.active : prev.active !== false,
  });

  if (idx >= 0) data.items[idx] = row;
  else data.items.push(row);
  write(data);
  return row;
}

export function remove(id: string) {
  const data = read();
  data.items = data.items.filter((x) => x.id !== id);
  scrubAssignments(data.assignments, id);
  data.sets = (data.sets || []).map((s) => ({
    ...s,
    itemIds: (s.itemIds || []).filter((x) => x !== id),
  }));
  write(data);
  return true;
}

export function getIncome(): Income {
  return normalizeIncome(read().income);
}

export function setIncome(income: Income): Income {
  const data = read();
  data.income = normalizeIncome(income);
  write(data);
  return data.income;
}

export function getAssignments() {
  return normalizeAssignments(read().assignments);
}

function normalizeSets(raw: unknown, itemIds: string[]): ItemSet[] {
  const known = new Set(itemIds);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => {
      const row = s as Partial<ItemSet>;
      return {
        id: String(row.id || ""),
        name: String(row.name || "").trim(),
        itemIds: [...new Set((row.itemIds || []).map(String).filter((id) => known.has(id)))],
        createdAt: String(row.createdAt || ""),
      };
    })
    .filter((s) => s.id && s.name);
}

export function getSets(): ItemSet[] {
  const data = read();
  return normalizeSets(
    data.sets,
    data.items.map((x) => x.id)
  );
}

export function saveSet(name: string, itemIds?: string[]): ItemSet[] {
  const label = String(name || "").trim();
  if (!label) throw new Error("name required");
  const data = read();
  if (!Array.isArray(data.sets)) data.sets = [];
  if (setNameTaken(data.sets, label)) throw new Error("duplicate name");
  const known = new Set(data.items.map((x) => x.id));
  const ids = Array.isArray(itemIds)
    ? [...new Set(itemIds.map(String).filter((id) => known.has(id)))]
    : data.items.filter((it) => it.active !== false).map((it) => it.id);
  if (!ids.length) throw new Error("no items");
  data.sets.push({
    id: crypto.randomUUID(),
    name: label,
    itemIds: ids,
    createdAt: new Date().toISOString(),
  });
  write(data);
  return getSets();
}

export function removeSet(id: string): ItemSet[] {
  const data = read();
  data.sets = (data.sets || []).filter((s) => s.id !== id);
  pruneOrphanItems(data);
  write(data);
  return getSets();
}

export function updateSet(id: string, patch: { name?: string; itemIds?: string[] } = {}): ItemSet[] {
  const data = read();
  if (!Array.isArray(data.sets)) data.sets = [];
  const idx = data.sets.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error("set not found");

  if (patch.name !== undefined) {
    const label = String(patch.name || "").trim();
    if (!label) throw new Error("name required");
    if (setNameTaken(data.sets, label, id)) throw new Error("duplicate name");
    data.sets[idx].name = label;
  }

  if (Array.isArray(patch.itemIds)) {
    const known = new Set(data.items.map((x) => x.id));
    const oldIds = [...(data.sets[idx].itemIds || [])];
    const nextIds = [...new Set(patch.itemIds.map(String).filter((x) => known.has(x)))];
    if (!nextIds.length) throw new Error("no items");
    data.sets[idx].itemIds = nextIds;
    reapplySetMonths(data, oldIds, nextIds);
  }

  pruneOrphanItems(data);
  write(data);
  return getSets();
}

export function toggleSetMonth(setId: string, monthKey: string) {
  if (!MONTH_KEY.test(monthKey)) throw new Error("invalid month");
  const data = read();
  const set = (data.sets || []).find((s) => s.id === setId);
  if (!set) throw new Error("set not found");
  const ids = (set.itemIds || []).filter((id) => data.items.some((it) => it.id === id));
  if (!ids.length) throw new Error("empty set");

  toggleIdsInMonth(data.assignments, monthKey, ids);
  write(data);
  return data.assignments;
}

export function exportSnapshot(): MutableLedger {
  return read();
}

export function importSnapshot(raw: unknown) {
  write(migrateSnapshot(raw));
  return true;
}
