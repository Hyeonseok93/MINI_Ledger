"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// electron/main.ts
var import_electron = require("electron");
var import_node_path2 = __toESM(require("node:path"));
var import_node_fs2 = __toESM(require("node:fs"));

// electron/store.ts
var import_node_fs = __toESM(require("node:fs"));
var import_node_path = __toESM(require("node:path"));
var import_node_crypto = __toESM(require("node:crypto"));

// src/format.ts
var DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
var MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
var INCOME_START = { year: 2026, month: 9 };

// src/snapshot.ts
function isLedgerSnapshot(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const o = raw;
  if (!Array.isArray(o.items)) return false;
  if (o.assignments !== void 0 && (typeof o.assignments !== "object" || Array.isArray(o.assignments))) {
    return false;
  }
  if (o.sets !== void 0 && !Array.isArray(o.sets)) return false;
  if (o.income !== void 0 && (typeof o.income !== "object" || Array.isArray(o.income))) return false;
  return true;
}

// src/ledgerData.ts
var MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;
var CYCLE_VALUES = ["daily", "weekly", "monthly", "quarterly", "yearly"];
var CATEGORY_REMAP = {
  \uC18C\uD504\uD2B8\uC6E8\uC5B4: "\uAD6C\uB3C5",
  "\uB300\uCD9C\xB7\uC774\uC790": "\uB300\uCD9C",
  "\uC800\uCD95\xB7\uD22C\uC790": "\uC800\uCD95",
  "\uC6B4\uB3D9\xB7\uCDE8\uBBF8": "\uC6B4\uB3D9",
  "\uD68C\uBE44\xB7\uACBD\uC870\uC0AC": "\uD68C\uBE44",
  "\uAC00\uC871\xB7\uC6A9\uB3C8": "\uC6A9\uB3C8"
};
var DEFAULT_SNAPSHOT = {
  version: 3,
  items: [],
  assignments: {},
  sets: [],
  income: { base: 0, months: {} }
};
function monthKeysThrough(end = /* @__PURE__ */ new Date(), start = INCOME_START) {
  const keys = [];
  let y = start.year;
  let m = start.month;
  const endY = end.getFullYear();
  const endM = end.getMonth() + 1;
  while (y < endY || y === endY && m <= endM) {
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
  const raw = String(category ?? "").trim() || "\uAE30\uD0C0";
  return CATEGORY_REMAP[raw] ?? raw;
}
function normalizeIncome(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const base = Math.max(0, Math.round(Number(src.base) || 0));
  const months = {};
  const monthSrc = src.months && typeof src.months === "object" && !Array.isArray(src.months) ? src.months : {};
  for (const [key, value] of Object.entries(monthSrc)) {
    const n = Math.round(Number(value));
    if (MONTH_KEY.test(key) && Number.isFinite(n) && n >= 0) months[key] = n;
  }
  return { base, months };
}
function scrubAssignments(assignments, id) {
  for (const key of Object.keys(assignments)) {
    assignments[key] = assignments[key].filter((x) => x !== id);
    if (!assignments[key].length) delete assignments[key];
  }
}
function dropReleasedOrphans(data, releasedIds) {
  const used = /* @__PURE__ */ new Set();
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
function clampInt(v, min, max, fallback) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
function normalizeItem(row) {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? "").trim(),
    amount: Number(row.amount) || 0,
    cycle: CYCLE_VALUES.includes(row.cycle) ? row.cycle : "monthly",
    day: clampInt(row.day, 1, 31, 1),
    weekday: clampInt(row.weekday, 0, 6, 1),
    month: clampInt(row.month, 1, 12, 1),
    category: remapCategory(row.category),
    note: String(row.note ?? "").trim()
  };
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
function toggleSetMonthIds(assignments, sets, setId, monthKey, ids) {
  if (!MONTH_KEY.test(monthKey)) throw new Error("invalid month");
  const current = new Set(assignments[monthKey] ?? []);
  const allOn = ids.length > 0 && ids.every((id) => current.has(id));
  if (allOn) {
    for (const id of ids) {
      const keptByOther = sets.some((s) => {
        if (s.id === setId) return false;
        const sIds = (s.itemIds || []).filter(Boolean);
        if (!sIds.length || !sIds.includes(id)) return false;
        return sIds.every((sid) => current.has(sid));
      });
      if (!keptByOther) current.delete(id);
    }
  } else {
    ids.forEach((id) => current.add(id));
  }
  if (current.size) assignments[monthKey] = [...current];
  else delete assignments[monthKey];
}
function setNameTaken(sets, name, excludeId) {
  const label = String(name || "").trim().toLowerCase();
  if (!label) return false;
  return (sets || []).some(
    (s) => s.id !== excludeId && String(s.name || "").trim().toLowerCase() === label
  );
}
function migrateSnapshot(raw) {
  if (!isLedgerSnapshot(raw)) throw new Error("invalid backup");
  const data = structuredClone(raw);
  const hadAssignments = data.assignments != null && typeof data.assignments === "object";
  const assignments = normalizeAssignments(data.assignments);
  const rawItems = Array.isArray(data.items) ? data.items : [];
  if (!hadAssignments && rawItems.length > 0 && Object.keys(assignments).length === 0) {
    const ids = rawItems.map((it) => String(it.id || "")).filter(Boolean);
    for (const key of monthKeysThrough()) assignments[key] = [...ids];
  }
  const items = rawItems.map(
    (it) => normalizeItem({
      id: String(it.id || ""),
      name: String(it.name ?? ""),
      amount: Number(it.amount) || 0,
      cycle: it.cycle,
      day: Number(it.day) || 1,
      weekday: Number(it.weekday) || 1,
      month: Number(it.month) || 1,
      category: it.category,
      note: String(it.note ?? "")
    })
  );
  return {
    version: Math.max(3, Number(data.version) || 3),
    items,
    assignments,
    sets: Array.isArray(data.sets) ? data.sets : [],
    income: normalizeIncome(data.income)
  };
}

// electron/store.ts
var storeDir = "";
var filePath = "";
function ensure() {
  if (!import_node_fs.default.existsSync(storeDir)) import_node_fs.default.mkdirSync(storeDir, { recursive: true });
  if (!import_node_fs.default.existsSync(filePath)) {
    import_node_fs.default.writeFileSync(filePath, JSON.stringify(DEFAULT_SNAPSHOT, null, 2), "utf8");
  }
}
function read() {
  ensure();
  try {
    return migrateSnapshot(JSON.parse(import_node_fs.default.readFileSync(filePath, "utf8")));
  } catch {
    return structuredClone(DEFAULT_SNAPSHOT);
  }
}
function write(data) {
  ensure();
  data.version = Math.max(3, Number(data.version) || 3);
  data.assignments = normalizeAssignments(data.assignments);
  import_node_fs.default.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}
function init(userData) {
  storeDir = import_node_path.default.join(userData, "store");
  filePath = import_node_path.default.join(storeDir, "ledger.json");
  ensure();
  write(read());
}
function getStoreDir() {
  return storeDir;
}
function getAll() {
  return read().items.map(normalizeItem);
}
function upsert(item) {
  const data = read();
  const idx = item.id ? data.items.findIndex((x) => x.id === item.id) : -1;
  if (item.id && idx < 0) throw new Error("not found");
  const prev = idx >= 0 ? data.items[idx] : {
    id: import_node_crypto.default.randomUUID(),
    name: "",
    amount: 0,
    cycle: "monthly",
    day: 1,
    weekday: 1,
    month: 1,
    category: "\uAE30\uD0C0",
    note: ""
  };
  const row = normalizeItem({
    ...prev,
    name: String(item.name ?? prev.name ?? "").trim(),
    amount: Number(item.amount ?? prev.amount) || 0,
    cycle: item.cycle ?? prev.cycle,
    day: Number(item.day ?? prev.day),
    weekday: Number(item.weekday ?? prev.weekday),
    month: Number(item.month ?? prev.month),
    category: String(item.category ?? prev.category ?? "\uAE30\uD0C0"),
    note: String(item.note ?? prev.note ?? "")
  });
  if (idx >= 0) data.items[idx] = row;
  else data.items.push(row);
  write(data);
  return row;
}
function remove(id) {
  const data = read();
  data.items = data.items.filter((x) => x.id !== id);
  scrubAssignments(data.assignments, id);
  data.sets = (data.sets || []).map((s) => ({
    ...s,
    itemIds: (s.itemIds || []).filter((x) => x !== id)
  }));
  write(data);
  return true;
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
function normalizeSets(raw, itemIds) {
  const known = new Set(itemIds);
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => {
    const row = s;
    return {
      id: String(row.id || ""),
      name: String(row.name || "").trim(),
      itemIds: [...new Set((row.itemIds || []).map(String).filter((id) => known.has(id)))],
      createdAt: String(row.createdAt || "")
    };
  }).filter((s) => s.id && s.name);
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
  if (setNameTaken(data.sets, label)) throw new Error("duplicate name");
  const known = new Set(data.items.map((x) => x.id));
  const ids = Array.isArray(itemIds) ? [...new Set(itemIds.map(String).filter((id) => known.has(id)))] : data.items.map((it) => it.id);
  if (!ids.length) throw new Error("no items");
  data.sets.push({
    id: import_node_crypto.default.randomUUID(),
    name: label,
    itemIds: ids,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  write(data);
  return getSets();
}
function removeSet(id) {
  const data = read();
  const victim = (data.sets || []).find((s) => s.id === id);
  const released = [...victim?.itemIds || []];
  data.sets = (data.sets || []).filter((s) => s.id !== id);
  dropReleasedOrphans(data, released);
  write(data);
  return getSets();
}
function updateSet(id, patch = {}) {
  const data = read();
  if (!Array.isArray(data.sets)) data.sets = [];
  const idx = data.sets.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error("set not found");
  if (patch.name !== void 0) {
    const label = String(patch.name || "").trim();
    if (!label) throw new Error("name required");
    if (setNameTaken(data.sets, label, id)) throw new Error("duplicate name");
    data.sets[idx].name = label;
  }
  if (Array.isArray(patch.itemIds)) {
    const known = new Set(data.items.map((x) => x.id));
    const oldIds = [...data.sets[idx].itemIds || []];
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
function toggleSetMonth(setId, monthKey) {
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
function exportSnapshot() {
  return read();
}
function importSnapshot(raw) {
  write(migrateSnapshot(raw));
  return true;
}

// electron/main.ts
var isDev = !import_electron.app.isPackaged;
var mainWindow = null;
function createWindow() {
  mainWindow = new import_electron.BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1280,
    minHeight: 640,
    backgroundColor: "#0a0c10",
    title: "Ledger",
    icon: import_node_path2.default.join(__dirname, "..", "assets", "ledger.png"),
    frame: false,
    show: false,
    webPreferences: {
      preload: import_node_path2.default.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  const sendMaximized = () => mainWindow?.webContents.send("window:maximized", mainWindow.isMaximized());
  mainWindow.on("maximize", sendMaximized);
  mainWindow.on("unmaximize", sendMaximized);
  if (isDev) {
    mainWindow.loadURL("http://127.0.0.1:5173");
  } else {
    mainWindow.loadFile(import_node_path2.default.join(__dirname, "..", "dist", "index.html"));
  }
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    import_electron.shell.openExternal(url);
    return { action: "deny" };
  });
}
function registerIpc() {
  const win = (e) => import_electron.BrowserWindow.fromWebContents(e.sender);
  import_electron.ipcMain.handle("store:getAll", () => getAll());
  import_electron.ipcMain.handle("store:upsert", (_e, item) => upsert(item));
  import_electron.ipcMain.handle("store:remove", (_e, id) => remove(id));
  import_electron.ipcMain.handle("assign:get", () => getAssignments());
  import_electron.ipcMain.handle("assign:toggleSetMonth", (_e, setId, monthKey) => toggleSetMonth(setId, monthKey));
  import_electron.ipcMain.handle("sets:get", () => getSets());
  import_electron.ipcMain.handle("sets:save", (_e, name, itemIds) => saveSet(name, itemIds));
  import_electron.ipcMain.handle("sets:remove", (_e, id) => removeSet(id));
  import_electron.ipcMain.handle("sets:update", (_e, id, patch) => updateSet(id, patch));
  import_electron.ipcMain.handle("income:get", () => getIncome());
  import_electron.ipcMain.handle("income:set", (_e, income) => setIncome(income));
  import_electron.ipcMain.handle("app:getPaths", () => ({
    userData: import_electron.app.getPath("userData"),
    storeDir: getStoreDir()
  }));
  import_electron.ipcMain.handle("data:export", async (e) => {
    const w = win(e);
    const stamp = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const opts = {
      title: "Export ledger JSON",
      defaultPath: `ledger-${stamp}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }]
    };
    const result = w ? await import_electron.dialog.showSaveDialog(w, opts) : await import_electron.dialog.showSaveDialog(opts);
    if (result.canceled || !result.filePath) return { ok: false };
    import_node_fs2.default.writeFileSync(result.filePath, JSON.stringify(exportSnapshot(), null, 2), "utf8");
    return { ok: true, path: result.filePath };
  });
  import_electron.ipcMain.handle("data:import", async (e) => {
    const w = win(e);
    const openOpts = {
      title: "Import ledger JSON",
      filters: [{ name: "JSON", extensions: ["json"] }],
      properties: ["openFile"]
    };
    const picked = w ? await import_electron.dialog.showOpenDialog(w, openOpts) : await import_electron.dialog.showOpenDialog(openOpts);
    if (picked.canceled || !picked.filePaths[0]) return { ok: false };
    const msgOpts = {
      type: "warning",
      buttons: ["\uCDE8\uC18C", "\uAC00\uC838\uC624\uAE30"],
      defaultId: 1,
      cancelId: 0,
      title: "JSON \uAC00\uC838\uC624\uAE30",
      message: "\uD604\uC7AC \uC7A5\uBD80\uB97C \uC120\uD0DD\uD55C \uD30C\uC77C\uB85C \uBC14\uAFC0\uAE4C\uC694?",
      detail: "\uD56D\uBAA9\xB7\uC138\uD2B8\xB7\uC6D4 \uC801\uC6A9\xB7\uC218\uC785\uC774 \uBAA8\uB450 \uB36E\uC5B4\uC50C\uC6CC\uC9D1\uB2C8\uB2E4."
    };
    const confirm = w ? await import_electron.dialog.showMessageBox(w, msgOpts) : await import_electron.dialog.showMessageBox(msgOpts);
    if (confirm.response !== 1) return { ok: false };
    let raw;
    try {
      raw = JSON.parse(import_node_fs2.default.readFileSync(picked.filePaths[0], "utf8"));
    } catch {
      throw new Error("JSON \uD30C\uC77C\uC744 \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4");
    }
    importSnapshot(raw);
    return { ok: true, path: picked.filePaths[0] };
  });
  import_electron.ipcMain.on("window:minimize", (e) => win(e)?.minimize());
  import_electron.ipcMain.on("window:toggleMaximize", (e) => {
    const w = win(e);
    if (!w) return;
    if (w.isMaximized()) w.unmaximize();
    else w.maximize();
  });
  import_electron.ipcMain.on("window:close", (e) => win(e)?.close());
  import_electron.ipcMain.handle("window:isMaximized", (e) => win(e)?.isMaximized() ?? false);
}
import_electron.app.whenReady().then(() => {
  import_electron.Menu.setApplicationMenu(null);
  init(import_electron.app.getPath("userData"));
  registerIpc();
  createWindow();
});
import_electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") import_electron.app.quit();
});
import_electron.app.on("activate", () => {
  if (import_electron.BrowserWindow.getAllWindows().length === 0) createWindow();
});
