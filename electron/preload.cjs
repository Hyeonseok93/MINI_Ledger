"use strict";

// electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("ledger", {
  getAll: () => import_electron.ipcRenderer.invoke("store:getAll"),
  upsert: (item) => import_electron.ipcRenderer.invoke("store:upsert", item),
  remove: (id) => import_electron.ipcRenderer.invoke("store:remove", id),
  getAssignments: () => import_electron.ipcRenderer.invoke("assign:get"),
  toggleAssign: (itemId, monthKey) => import_electron.ipcRenderer.invoke("assign:toggle", itemId, monthKey),
  assignToMonths: (itemId, monthKeys) => import_electron.ipcRenderer.invoke("assign:toMonths", itemId, monthKeys),
  toggleSetMonth: (setId, monthKey) => import_electron.ipcRenderer.invoke("assign:toggleSetMonth", setId, monthKey),
  getSets: () => import_electron.ipcRenderer.invoke("sets:get"),
  saveSet: (name, itemIds) => import_electron.ipcRenderer.invoke("sets:save", name, itemIds),
  removeSet: (id) => import_electron.ipcRenderer.invoke("sets:remove", id),
  updateSet: (id, patch) => import_electron.ipcRenderer.invoke("sets:update", id, patch),
  getIncome: () => import_electron.ipcRenderer.invoke("income:get"),
  setIncome: (income) => import_electron.ipcRenderer.invoke("income:set", income),
  getPaths: () => import_electron.ipcRenderer.invoke("app:getPaths"),
  exportJson: () => import_electron.ipcRenderer.invoke("data:export"),
  importJson: () => import_electron.ipcRenderer.invoke("data:import")
});
import_electron.contextBridge.exposeInMainWorld("windowControls", {
  minimize: () => import_electron.ipcRenderer.send("window:minimize"),
  toggleMaximize: () => import_electron.ipcRenderer.send("window:toggleMaximize"),
  close: () => import_electron.ipcRenderer.send("window:close"),
  isMaximized: () => import_electron.ipcRenderer.invoke("window:isMaximized"),
  onMaximizedChange: (cb) => {
    const listener = (_e, value) => cb(value);
    import_electron.ipcRenderer.on("window:maximized", listener);
    return () => import_electron.ipcRenderer.removeListener("window:maximized", listener);
  }
});
