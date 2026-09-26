const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ledger", {
  getAll: () => ipcRenderer.invoke("store:getAll"),
  upsert: (item) => ipcRenderer.invoke("store:upsert", item),
  remove: (id) => ipcRenderer.invoke("store:remove", id),
  getAssignments: () => ipcRenderer.invoke("assign:get"),
  toggleAssign: (itemId, monthKey) => ipcRenderer.invoke("assign:toggle", itemId, monthKey),
  assignToMonths: (itemId, monthKeys) => ipcRenderer.invoke("assign:toMonths", itemId, monthKeys),
  toggleSetMonth: (setId, monthKey) => ipcRenderer.invoke("assign:toggleSetMonth", setId, monthKey),
  getSets: () => ipcRenderer.invoke("sets:get"),
  saveSet: (name) => ipcRenderer.invoke("sets:save", name),
  removeSet: (id) => ipcRenderer.invoke("sets:remove", id),
  updateSet: (id, patch) => ipcRenderer.invoke("sets:update", id, patch),
  getIncome: () => ipcRenderer.invoke("income:get"),
  setIncome: (income) => ipcRenderer.invoke("income:set", income),
  getPaths: () => ipcRenderer.invoke("app:getPaths"),
});

contextBridge.exposeInMainWorld("windowControls", {
  minimize: () => ipcRenderer.send("window:minimize"),
  toggleMaximize: () => ipcRenderer.send("window:toggleMaximize"),
  close: () => ipcRenderer.send("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:isMaximized"),
  onMaximizedChange: (cb) => {
    const listener = (_e, value) => cb(value);
    ipcRenderer.on("window:maximized", listener);
    return () => ipcRenderer.removeListener("window:maximized", listener);
  },
});
