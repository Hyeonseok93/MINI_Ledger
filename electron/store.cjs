const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let storeDir = "";
let filePath = "";

const DEFAULT_DATA = {
  version: 1,
  items: [],
};

const CYCLES = ["daily", "weekly", "monthly", "quarterly", "yearly"];

function ensure() {
  if (!fs.existsSync(storeDir)) fs.mkdirSync(storeDir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(DEFAULT_DATA, null, 2), "utf8");
  }
}

function read() {
  ensure();
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!Array.isArray(raw.items)) raw.items = [];
    return raw;
  } catch {
    return structuredClone(DEFAULT_DATA);
  }
}

function write(data) {
  ensure();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function init(userData) {
  storeDir = path.join(userData, "store");
  filePath = path.join(storeDir, "ledger.json");
  ensure();
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
    category: String(item.category ?? prev.category ?? "기타").trim() || "기타",
    note: String(item.note ?? prev.note ?? "").trim(),
    active: item.active !== undefined ? !!item.active : prev.active !== false,
    updatedAt: now,
  });

  if (idx >= 0) data.items[idx] = row;
  else data.items.push(row);
  write(data);
  return row;
}

function remove(id) {
  const data = read();
  data.items = data.items.filter((x) => x.id !== id);
  write(data);
  return true;
}

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

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

module.exports = {
  init,
  getStoreDir,
  getAll,
  upsert,
  remove,
  getIncome,
  setIncome,
};
