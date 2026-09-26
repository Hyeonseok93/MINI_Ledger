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
var storeDir = "";
var filePath = "";
var START = { year: 2026, month: 9 };
var MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;
var CYCLES = ["daily", "weekly", "monthly", "quarterly", "yearly"];
var CATEGORY_REMAP = {
  \uC18C\uD504\uD2B8\uC6E8\uC5B4: "\uAD6C\uB3C5",
  "\uB300\uCD9C\xB7\uC774\uC790": "\uB300\uCD9C",
  "\uC800\uCD95\xB7\uD22C\uC790": "\uC800\uCD95",
  "\uC6B4\uB3D9\xB7\uCDE8\uBBF8": "\uC6B4\uB3D9",
  "\uD68C\uBE44\xB7\uACBD\uC870\uC0AC": "\uD68C\uBE44",
  "\uAC00\uC871\xB7\uC6A9\uB3C8": "\uC6A9\uB3C8"
};
var DEFAULT_DATA = {
  version: 3,
  items: [],
  assignments: {},
  sets: [],
  income: { base: 0, months: {} }
};
function ensure() {
  if (!import_node_fs.default.existsSync(storeDir)) import_node_fs.default.mkdirSync(storeDir, { recursive: true });
  if (!import_node_fs.default.existsSync(filePath)) {
    import_node_fs.default.writeFileSync(filePath, JSON.stringify(DEFAULT_DATA, null, 2), "utf8");
  }
}
function monthKeysThrough(end = /* @__PURE__ */ new Date()) {
  const keys = [];
  let y = START.year;
  let m = START.month;
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
function migrate(raw) {
  if (!Array.isArray(raw.items)) raw.items = [];
  const hadAssignments = raw.assignments && typeof raw.assignments === "object";
  raw.assignments = normalizeAssignments(raw.assignments);
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
    const raw = migrate(JSON.parse(import_node_fs.default.readFileSync(filePath, "utf8")));
    return raw;
  } catch {
    return structuredClone(DEFAULT_DATA);
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
    category: remapCategory(row.category)
  };
}
function getAll() {
  return read().items.map(normalize);
}
function upsert(item) {
  const data = read();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const idx = item.id ? data.items.findIndex((x) => x.id === item.id) : -1;
  if (item.id && idx < 0) throw new Error("not found");
  const prev = idx >= 0 ? data.items[idx] : { id: import_node_crypto.default.randomUUID(), createdAt: now };
  const row = normalize({
    ...prev,
    name: String(item.name ?? prev.name ?? "").trim(),
    amount: Number(item.amount ?? prev.amount) || 0,
    cycle: item.cycle ?? prev.cycle,
    day: item.day ?? prev.day,
    weekday: item.weekday ?? prev.weekday,
    month: item.month ?? prev.month,
    category: remapCategory(String(item.category ?? prev.category ?? "\uAE30\uD0C0").trim() || "\uAE30\uD0C0"),
    note: String(item.note ?? prev.note ?? "").trim(),
    active: item.active !== void 0 ? !!item.active : prev.active !== false,
    updatedAt: now
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
function pruneOrphanItems(data) {
  if (!(data.sets || []).length) return;
  const used = /* @__PURE__ */ new Set();
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
    itemIds: (s.itemIds || []).filter((x) => x !== id)
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
  return raw.map((s) => ({
    id: String(s.id || ""),
    name: String(s.name || "").trim(),
    itemIds: [...new Set((s.itemIds || []).map(String).filter((id) => known.has(id)))],
    createdAt: String(s.createdAt || "")
  })).filter((s) => s.id && s.name);
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
  const ids = Array.isArray(itemIds) ? [...new Set(itemIds.map(String).filter((id) => known.has(id)))] : data.items.filter((it) => it.active !== false).map((it) => it.id);
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
  if (patch.name !== void 0) {
    const label = String(patch.name || "").trim();
    if (!label) throw new Error("name required");
    if (nameTaken(data.sets, label, id)) throw new Error("duplicate name");
    data.sets[idx].name = label;
  }
  if (Array.isArray(patch.itemIds) || patch.refreshItems) {
    const known = new Set(data.items.map((x) => x.id));
    const oldIds = [...data.sets[idx].itemIds || []];
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
function exportSnapshot() {
  return read();
}
function importSnapshot(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("invalid backup");
  const data = migrate(structuredClone(raw));
  if (!Array.isArray(data.items)) throw new Error("invalid backup");
  write(data);
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
  import_electron.ipcMain.handle("assign:toggle", (_e, itemId, monthKey) => toggleAssign(itemId, monthKey));
  import_electron.ipcMain.handle("assign:toMonths", (_e, itemId, monthKeys) => assignItemToMonths(itemId, monthKeys));
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
    const result = await import_electron.dialog.showSaveDialog(w ?? void 0, {
      title: "Export ledger JSON",
      defaultPath: `ledger-${stamp}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }]
    });
    if (result.canceled || !result.filePath) return { ok: false };
    import_node_fs2.default.writeFileSync(result.filePath, JSON.stringify(exportSnapshot(), null, 2), "utf8");
    return { ok: true, path: result.filePath };
  });
  import_electron.ipcMain.handle("data:import", async (e) => {
    const w = win(e);
    const picked = await import_electron.dialog.showOpenDialog(w ?? void 0, {
      title: "Import ledger JSON",
      filters: [{ name: "JSON", extensions: ["json"] }],
      properties: ["openFile"]
    });
    if (picked.canceled || !picked.filePaths[0]) return { ok: false };
    const confirm = await import_electron.dialog.showMessageBox(w ?? void 0, {
      type: "warning",
      buttons: ["\uCDE8\uC18C", "\uAC00\uC838\uC624\uAE30"],
      defaultId: 1,
      cancelId: 0,
      title: "JSON \uAC00\uC838\uC624\uAE30",
      message: "\uD604\uC7AC \uC7A5\uBD80\uB97C \uC120\uD0DD\uD55C \uD30C\uC77C\uB85C \uBC14\uAFC0\uAE4C\uC694?",
      detail: "\uD56D\uBAA9\xB7\uC138\uD2B8\xB7\uC6D4 \uC801\uC6A9\xB7\uC218\uC785\uC774 \uBAA8\uB450 \uB36E\uC5B4\uC50C\uC6CC\uC9D1\uB2C8\uB2E4."
    });
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
