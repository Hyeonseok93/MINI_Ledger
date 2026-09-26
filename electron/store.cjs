const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let storeDir = "";
let filePath = "";

const START = { year: 2026, month: 9 };
const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;
const CYCLES = ["daily", "weekly", "monthly", "quarterly", "yearly"];

/** Old combined labels → current single labels */
const CATEGORY_REMAP = {
  소프트웨어: "구독",
  "대출·이자": "대출",
  "저축·투자": "저축",
  "운동·취미": "운동",
  "회비·경조사": "회비",
  "가족·용돈": "용돈",
};

const DEFAULT_DATA = {
  version: 3,
  items: [],
  assignments: {},
  sets: [],
  income: { base: 0, months: {} },
};


function ensure() {
  if (!fs.existsSync(storeDir)) fs.mkdirSync(storeDir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(DEFAULT_DATA, null, 2), "utf8");
  }
}

function monthKeysThrough(end = new Date()) {
  const keys = [];
  let y = START.year;
  let m = START.month;
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

function normalizeAssignments(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!MONTH_KEY.test(key) || !Array.isArray(value)) continue;
    const ids = [...new Set(value.map(String).filter(Boolean))];
    if (ids.length) out[key] = ids;
  }
  return out;
}

function remapCategory(category) {
  const raw = String(category ?? "").trim() || "기타";
  return CATEGORY_REMAP[raw] ?? raw;
}

function migrate(raw) {
  if (!Array.isArray(raw.items)) raw.items = [];
  const hadAssignments = raw.assignments && typeof raw.assignments === "object";
  raw.assignments = normalizeAssignments(raw.assignments);

  // v1 data: items existed without month assignment → seed through current month
  if (!hadAssignments && raw.items.length > 0 && Object.keys(raw.assignments).length === 0) {
    const ids = raw.items.filter((it) => it.active !== false).map((it) => it.id).filter(Boolean);
    for (const key of monthKeysThrough()) raw.assignments[key] = [...ids];
  }

  let categoriesTouched = false;
  for (const it of raw.items) {
    const next = remapCategory(it.category);
    if (next !== it.category) {
      it.category = next;
      categoriesTouched = true;
    }
  }
  if (categoriesTouched || Number(raw.version) < 3) raw.version = 3;

  if (!raw.income) raw.income = { base: 0, months: {} };
  if (!Array.isArray(raw.sets)) raw.sets = [];
  return raw;
}

function read() {
  ensure();
  try {
    const raw = migrate(JSON.parse(fs.readFileSync(filePath, "utf8")));
    return raw;
  } catch {
    return structuredClone(DEFAULT_DATA);
  }
}

function write(data) {
  ensure();
  data.version = Math.max(3, Number(data.version) || 3);
  data.assignments = normalizeAssignments(data.assignments);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function init(userData) {
  storeDir = path.join(userData, "store");
  filePath = path.join(storeDir, "ledger.json");
  ensure();
  // run migration once on boot
  write(read());
}

function getStoreDir() {
  return storeDir;
}

function clampInt(v, min, max, fallback) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalize(row) {
  return {
    ...row,
    cycle: CYCLES.includes(row.cycle) ? row.cycle : "monthly",
    day: clampInt(row.day, 1, 31, 1),
    weekday: clampInt(row.weekday, 0, 6, 1),
    month: clampInt(row.month, 1, 12, 1),
    category: remapCategory(row.category),
  };
}

function getAll() {
  return read().items.map(normalize);
}

function upsert(item) {
  const data = read();
  const now = new Date().toISOString();
  const idx = item.id ? data.items.findIndex((x) => x.id === item.id) : -1;
  if (item.id && idx < 0) throw new Error("not found");
  const prev = idx >= 0 ? data.items[idx] : { id: crypto.randomUUID(), createdAt: now };

  const row = normalize({
    ...prev,
    name: String(item.name ?? prev.name ?? "").trim(),
    amount: Number(item.amount ?? prev.amount) || 0,
    cycle: item.cycle ?? prev.cycle,
    day: item.day ?? prev.day,
    weekday: item.weekday ?? prev.weekday,
    month: item.month ?? prev.month,
    category: remapCategory(String(item.category ?? prev.category ?? "기타").trim() || "기타"),
    note: String(item.note ?? prev.note ?? "").trim(),
    active: item.active !== undefined ? !!item.active : prev.active !== false,
    updatedAt: now,
  });

  if (idx >= 0) data.items[idx] = row;
  else data.items.push(row);
  write(data);
  return row;
}

function scrubAssignments(data, id) {
  for (const key of Object.keys(data.assignments)) {
    data.assignments[key] = data.assignments[key].filter((x) => x !== id);
    if (!data.assignments[key].length) delete data.assignments[key];
  }
}

/** Drop items not referenced by any set (and scrub their month assignments). */
function pruneOrphanItems(data) {
  if (!(data.sets || []).length) return;
  const used = new Set();
  for (const s of data.sets || []) {
    for (const id of s.itemIds || []) used.add(id);
  }
  const kept = [];
  for (const it of data.items) {
    if (used.has(it.id)) kept.push(it);
    else scrubAssignments(data, it.id);
  }
  data.items = kept;
}

function remove(id) {
  const data = read();
  data.items = data.items.filter((x) => x.id !== id);
  scrubAssignments(data, id);
  data.sets = (data.sets || []).map((s) => ({
    ...s,
    itemIds: (s.itemIds || []).filter((x) => x !== id),
  }));
  write(data);
  return true;
}

function normalizeIncome(raw) {
  const base = Math.max(0, Math.round(Number(raw?.base) || 0));
  const months = {};
  for (const [key, value] of Object.entries(raw?.months ?? {})) {
    const n = Math.round(Number(value));
    if (MONTH_KEY.test(key) && Number.isFinite(n) && n >= 0) months[key] = n;
  }
  return { base, months };
}

function getIncome() {
  return normalizeIncome(read().income);
}

function setIncome(income) {
  const data = read();
  data.income = normalizeIncome(income);
  write(data);
  return data.income;
}

function getAssignments() {
  return normalizeAssignments(read().assignments);
}

function toggleAssign(itemId, monthKey) {
  if (!itemId) throw new Error("item required");
  if (!MONTH_KEY.test(monthKey)) throw new Error("invalid month");
  const data = read();
  if (!data.items.some((x) => x.id === itemId)) throw new Error("not found");

  const set = new Set(data.assignments[monthKey] ?? []);
  if (set.has(itemId)) set.delete(itemId);
  else set.add(itemId);

  if (set.size) data.assignments[monthKey] = [...set];
  else delete data.assignments[monthKey];

  write(data);
  return data.assignments;
}

function assignItemToMonths(itemId, monthKeys) {
  if (!itemId) throw new Error("item required");
  const data = read();
  if (!data.items.some((x) => x.id === itemId)) throw new Error("not found");
  for (const key of monthKeys) {
    if (!MONTH_KEY.test(key)) continue;
    const set = new Set(data.assignments[key] ?? []);
    set.add(itemId);
    data.assignments[key] = [...set];
  }
  write(data);
  return data.assignments;
}

function normalizeSets(raw, itemIds) {
  const known = new Set(itemIds);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => ({
      id: String(s.id || ""),
      name: String(s.name || "").trim(),
      itemIds: [...new Set((s.itemIds || []).map(String).filter((id) => known.has(id)))],
      createdAt: String(s.createdAt || ""),
    }))
    .filter((s) => s.id && s.name);
}

function nameTaken(sets, name, excludeId) {
  const label = String(name || "").trim().toLowerCase();
  if (!label) return false;
  return (sets || []).some((s) => s.id !== excludeId && String(s.name || "").trim().toLowerCase() === label);
}

function getSets() {
  const data = read();
  return normalizeSets(
    data.sets,
    data.items.map((x) => x.id)
  );
}

function saveSet(name, itemIds) {
  const label = String(name || "").trim();
  if (!label) throw new Error("name required");
  const data = read();
  if (!Array.isArray(data.sets)) data.sets = [];
  if (nameTaken(data.sets, label)) throw new Error("duplicate name");
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

function removeSet(id) {
  const data = read();
  data.sets = (data.sets || []).filter((s) => s.id !== id);
  pruneOrphanItems(data);
  write(data);
  return getSets();
}

function monthsWhereFullyApplied(assignments, itemIds) {
  const ids = [...new Set((itemIds || []).map(String).filter(Boolean))];
  if (!ids.length) return [];
  const keys = [];
  for (const [key, list] of Object.entries(assignments || {})) {
    if (!MONTH_KEY.test(key) || !Array.isArray(list)) continue;
    const bucket = new Set(list);
    if (ids.every((id) => bucket.has(id))) keys.push(key);
  }
  return keys;
}

/** Keep previously applied months in sync when a set's item list changes. */
function reapplySetMonths(data, oldIds, newIds) {
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

function updateSet(id, patch = {}) {
  const data = read();
  if (!Array.isArray(data.sets)) data.sets = [];
  const idx = data.sets.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error("set not found");

  if (patch.name !== undefined) {
    const label = String(patch.name || "").trim();
    if (!label) throw new Error("name required");
    if (nameTaken(data.sets, label, id)) throw new Error("duplicate name");
    data.sets[idx].name = label;
  }

  if (Array.isArray(patch.itemIds) || patch.refreshItems) {
    const known = new Set(data.items.map((x) => x.id));
    const oldIds = [...(data.sets[idx].itemIds || [])];
    let nextIds;
    if (Array.isArray(patch.itemIds)) {
      nextIds = [...new Set(patch.itemIds.map(String).filter((x) => known.has(x)))];
    } else {
      nextIds = data.items.filter((it) => it.active !== false).map((it) => it.id);
    }
    if (!nextIds.length) throw new Error("no items");
    data.sets[idx].itemIds = nextIds;
    reapplySetMonths(data, oldIds, nextIds);
  }

  pruneOrphanItems(data);
  write(data);
  return getSets();
}

/** Toggle whether a named set's items are applied to a month. */
function toggleSetMonth(setId, monthKey) {
  if (!MONTH_KEY.test(monthKey)) throw new Error("invalid month");
  const data = read();
  const set = (data.sets || []).find((s) => s.id === setId);
  if (!set) throw new Error("set not found");
  const ids = (set.itemIds || []).filter((id) => data.items.some((it) => it.id === id));
  if (!ids.length) throw new Error("empty set");

  const current = new Set(data.assignments[monthKey] ?? []);
  const allOn = ids.every((id) => current.has(id));
  if (allOn) ids.forEach((id) => current.delete(id));
  else ids.forEach((id) => current.add(id));

  if (current.size) data.assignments[monthKey] = [...current];
  else delete data.assignments[monthKey];

  write(data);
  return data.assignments;
}

module.exports = {
  init,
  getStoreDir,
  getAll,
  upsert,
  remove,
  getIncome,
  setIncome,
  getAssignments,
  toggleAssign,
  assignItemToMonths,
  getSets,
  saveSet,
  removeSet,
  updateSet,
  toggleSetMonth,
};
