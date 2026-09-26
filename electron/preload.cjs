const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ledger", {
  getAll: () => ipcRenderer.invoke("store:getAll"),
  upsert: (item) => ipcRenderer.invoke("store:upsert", item),
  remove: (id) => ipcRenderer.invoke("store:remove", id),
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
