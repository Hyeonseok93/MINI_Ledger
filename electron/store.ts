import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Cycle, FixedItem, Income, ItemSet } from "../src/schedule";
import {
  DEFAULT_SNAPSHOT,
  MONTH_KEY,
  type MutableLedger,
  dropReleasedOrphans,
  ensureOrphansInSet,
  migrateSnapshot,
  normalizeAssignments,
  normalizeIncome,
  normalizeItem,
  reapplySetMonths,
  scrubAssignments,
  setNameTaken,
  toggleSetMonthIds,
} from "../src/ledgerData";

let storeDir = "";
let filePath = "";
let backupPath = "";
let backupDir = "";
/** Daily copies kept in backups/ (one per day the ledger was opened or changed). */
const DAILY_KEEP = 14;
const DAILY_FILE = /^ledger-\d{4}-\d{2}-\d{2}\.json$/;
/** Set when ledger.json can't be parsed; blocks every write so the bad file is never overwritten. */
let loadError: Error | null = null;

type Draft = Partial<FixedItem> & {
  name?: string;
  amount?: number;
};

/** Write a temp file, flush it, then rename over the target so a crash never leaves it half-written. */
function writeAtomic(target: string, text: string) {
  const tmp = `${target}.tmp`;
  const fd = fs.openSync(tmp, "w");
  try {
    fs.writeFileSync(fd, text, "utf8");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.renameSync(tmp, target);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err;
  }
}

function parseFile(p: string): MutableLedger {
  return migrateSnapshot(JSON.parse(fs.readFileSync(p, "utf8")));
}

/** Keep a copy of the unreadable file and return the error that blocks further writes. */
function quarantine(): Error {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `ledger.corrupt-${stamp}.json`;
  fs.copyFileSync(filePath, path.join(storeDir, name));
  return new Error(`장부 파일을 읽을 수 없어 저장을 멈췄습니다. 원본은 ${name}에 보관했습니다. Import로 복구하세요.`);
}

function ensure() {
  if (!fs.existsSync(storeDir)) fs.mkdirSync(storeDir, { recursive: true });
  if (!fs.existsSync(filePath)) writeAtomic(filePath, JSON.stringify(DEFAULT_SNAPSHOT, null, 2));
}

function read(): MutableLedger {
  if (loadError) throw loadError;
  ensure();
  try {
    return parseFile(filePath);
  } catch {
    loadError = quarantine();
    throw loadError;
  }
}

function localDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** First save of each day keeps the file as it stood (backups/ledger-YYYY-MM-DD.json), newest DAILY_KEEP retained. */
function dailyBackup() {
  const target = path.join(backupDir, `ledger-${localDate(new Date())}.json`);
  if (fs.existsSync(target)) return;
  fs.mkdirSync(backupDir, { recursive: true });
  writeAtomic(target, fs.readFileSync(filePath, "utf8"));
  const stale = fs.readdirSync(backupDir).filter((f) => DAILY_FILE.test(f)).sort().slice(0, -DAILY_KEEP);
  for (const f of stale) fs.rmSync(path.join(backupDir, f), { force: true });
}

/** `backup` copies the current (last good) file to ledger.json.bak and the daily backup before replacing it. */
function write(data: MutableLedger, backup = true) {
  if (loadError) throw loadError;
  ensure();
  data.version = Math.max(3, Number(data.version) || 3);
  data.assignments = normalizeAssignments(data.assignments);
  if (backup) {
    fs.copyFileSync(filePath, backupPath);
    dailyBackup();
  }
  writeAtomic(filePath, JSON.stringify(data, null, 2));
}

/** Replace an unreadable ledger.json with a valid ledger.json.bak; false if there is none. */
function restoreBackup(): boolean {
  if (!fs.existsSync(backupPath)) return false;
  try {
    parseFile(backupPath);
  } catch {
    return false;
  }
  writeAtomic(filePath, fs.readFileSync(backupPath, "utf8"));
  loadError = null;
  return true;
}

export function init(userData: string) {
  storeDir = path.join(userData, "store");
  filePath = path.join(storeDir, "ledger.json");
  backupPath = `${filePath}.bak`;
  backupDir = path.join(storeDir, "backups");
  loadError = null;
  fs.mkdirSync(storeDir, { recursive: true });
  fs.rmSync(`${filePath}.tmp`, { force: true }); // leftover from an interrupted write
  let data: MutableLedger;
  try {
    data = read();
  } catch {
    if (!restoreBackup()) return; // stays blocked; the UI shows loadError
    data = read();
  }
  ensureOrphansInSet(data);
  write(data);
}

export function getStoreDir() {
  return storeDir;
}

export function getBackupDir() {
  return backupDir;
}

export function getAll(): FixedItem[] {
  return read().items.map(normalizeItem);
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
        };

  const row = normalizeItem({
    ...prev,
    name: String(item.name ?? prev.name ?? "").trim(),
    amount: Number(item.amount ?? prev.amount) || 0,
    cycle: (item.cycle ?? prev.cycle) as Cycle,
    day: Number(item.day ?? prev.day),
    weekday: Number(item.weekday ?? prev.weekday),
    month: Number(item.month ?? prev.month),
    category: String(item.category ?? prev.category ?? "기타"),
    note: String(item.note ?? prev.note ?? ""),
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
    : data.items.map((it) => it.id);
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
  const victim = (data.sets || []).find((s) => s.id === id);
  const released = [...(victim?.itemIds || [])];
  data.sets = (data.sets || []).filter((s) => s.id !== id);
  dropReleasedOrphans(data, released);
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
    dropReleasedOrphans(
      data,
      oldIds.filter((itemId) => !nextIds.includes(itemId))
    );
  }

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

  toggleSetMonthIds(data.assignments, data.sets || [], setId, monthKey, ids);
  write(data);
  return data.assignments;
}

export function exportSnapshot(): MutableLedger {
  return read();
}

export function importSnapshot(raw: unknown) {
  const data = migrateSnapshot(raw);
  ensureOrphansInSet(data);
  // A full import is the recovery path: it may replace an unreadable (already quarantined) file,
  // but that file must not become the backup.
  const broken = loadError !== null;
  loadError = null;
  write(data, !broken);
  return true;
}
