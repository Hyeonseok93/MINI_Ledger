import { app, BrowserWindow, Menu, ipcMain, shell, dialog } from "electron";
import path from "node:path";
import fs from "node:fs";
import * as store from "./store";

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1280,
    minHeight: 640,
    backgroundColor: "#0a0c10",
    title: "Ledger",
    icon: path.join(__dirname, "..", "assets", "ledger.png"),
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  const sendMaximized = () =>
    mainWindow?.webContents.send("window:maximized", mainWindow.isMaximized());
  mainWindow.on("maximize", sendMaximized);
  mainWindow.on("unmaximize", sendMaximized);

  if (isDev) {
    mainWindow.loadURL("http://127.0.0.1:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function registerIpc() {
  const win = (e: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent) =>
    BrowserWindow.fromWebContents(e.sender);

  ipcMain.handle("store:getAll", () => store.getAll());
  ipcMain.handle("store:upsert", (_e, item) => store.upsert(item));
  ipcMain.handle("store:remove", (_e, id) => store.remove(id));
  ipcMain.handle("assign:get", () => store.getAssignments());
  ipcMain.handle("assign:toggleSetMonth", (_e, setId, monthKey) => store.toggleSetMonth(setId, monthKey));
  ipcMain.handle("sets:get", () => store.getSets());
  ipcMain.handle("sets:save", (_e, name, itemIds) => store.saveSet(name, itemIds));
  ipcMain.handle("sets:remove", (_e, id) => store.removeSet(id));
  ipcMain.handle("sets:update", (_e, id, patch) => store.updateSet(id, patch));
  ipcMain.handle("income:get", () => store.getIncome());
  ipcMain.handle("income:set", (_e, income) => store.setIncome(income));
  ipcMain.handle("app:getPaths", () => ({
    userData: app.getPath("userData"),
    storeDir: store.getStoreDir(),
  }));

  ipcMain.handle("data:export", async (e) => {
    const w = win(e);
    const stamp = new Date().toISOString().slice(0, 10);
    const opts = {
      title: "Export ledger JSON",
      defaultPath: `ledger-${stamp}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    };
    const result = w ? await dialog.showSaveDialog(w, opts) : await dialog.showSaveDialog(opts);
    if (result.canceled || !result.filePath) return { ok: false };
    fs.writeFileSync(result.filePath, JSON.stringify(store.exportSnapshot(), null, 2), "utf8");
    return { ok: true, path: result.filePath };
  });

  ipcMain.handle("data:import", async (e) => {
    const w = win(e);
    const openOpts = {
      title: "Import ledger JSON",
      filters: [{ name: "JSON", extensions: ["json"] }],
      properties: ["openFile" as const],
    };
    const picked = w ? await dialog.showOpenDialog(w, openOpts) : await dialog.showOpenDialog(openOpts);
    if (picked.canceled || !picked.filePaths[0]) return { ok: false };

    const msgOpts = {
      type: "warning" as const,
      buttons: ["취소", "가져오기"],
      defaultId: 1,
      cancelId: 0,
      title: "JSON 가져오기",
      message: "현재 장부를 선택한 파일로 바꿀까요?",
      detail: "항목·세트·월 적용·수입이 모두 덮어씌워집니다.",
    };
    const confirm = w ? await dialog.showMessageBox(w, msgOpts) : await dialog.showMessageBox(msgOpts);
    if (confirm.response !== 1) return { ok: false };

    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(picked.filePaths[0], "utf8"));
    } catch {
      throw new Error("JSON 파일을 읽을 수 없습니다");
    }
    store.importSnapshot(raw);
    return { ok: true, path: picked.filePaths[0] };
  });

  ipcMain.on("window:minimize", (e) => win(e)?.minimize());
  ipcMain.on("window:toggleMaximize", (e) => {
    const w = win(e);
    if (!w) return;
    if (w.isMaximized()) w.unmaximize();
    else w.maximize();
  });
  ipcMain.on("window:close", (e) => win(e)?.close());
  ipcMain.handle("window:isMaximized", (e) => win(e)?.isMaximized() ?? false);
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  store.init(app.getPath("userData"));
  registerIpc();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
