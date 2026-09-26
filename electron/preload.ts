import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("ledger", {
  getAll: () => ipcRenderer.invoke("store:getAll"),
  upsert: (item: unknown) => ipcRenderer.invoke("store:upsert", item),
  remove: (id: string) => ipcRenderer.invoke("store:remove", id),
  getAssignments: () => ipcRenderer.invoke("assign:get"),
  toggleSetMonth: (setId: string, monthKey: string) =>
    ipcRenderer.invoke("assign:toggleSetMonth", setId, monthKey),
  getSets: () => ipcRenderer.invoke("sets:get"),
  saveSet: (name: string, itemIds: string[]) => ipcRenderer.invoke("sets:save", name, itemIds),
  removeSet: (id: string) => ipcRenderer.invoke("sets:remove", id),
  updateSet: (id: string, patch: unknown) => ipcRenderer.invoke("sets:update", id, patch),
  getIncome: () => ipcRenderer.invoke("income:get"),
  setIncome: (income: unknown) => ipcRenderer.invoke("income:set", income),
  getPaths: () => ipcRenderer.invoke("app:getPaths"),
  exportJson: () => ipcRenderer.invoke("data:export"),
  importJson: () => ipcRenderer.invoke("data:import"),
});

contextBridge.exposeInMainWorld("windowControls", {
  minimize: () => ipcRenderer.send("window:minimize"),
  toggleMaximize: () => ipcRenderer.send("window:toggleMaximize"),
  close: () => ipcRenderer.send("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:isMaximized"),
  onMaximizedChange: (cb: (maximized: boolean) => void) => {
    const listener = (_e: unknown, value: boolean) => cb(value);
    ipcRenderer.on("window:maximized", listener);
    return () => ipcRenderer.removeListener("window:maximized", listener);
  },
});
