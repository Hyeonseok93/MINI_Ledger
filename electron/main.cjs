const { app, BrowserWindow, Menu, ipcMain, shell } = require("electron");
const path = require("path");
const store = require("./store.cjs");

const isDev = !app.isPackaged;
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1280,
    minHeight: 640,
    backgroundColor: "#0a0c10",
    title: "Ledger",
    icon: path.join(__dirname, "..", "assets", "ledger-icon-bold.png"),
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  const sendMaximized = () =>
    mainWindow.webContents.send("window:maximized", mainWindow.isMaximized());
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
  ipcMain.handle("store:getAll", () => store.getAll());
  ipcMain.handle("store:upsert", (_e, item) => store.upsert(item));
  ipcMain.handle("store:remove", (_e, id) => store.remove(id));
  ipcMain.handle("income:get", () => store.getIncome());
  ipcMain.handle("income:set", (_e, income) => store.setIncome(income));
  ipcMain.handle("app:getPaths", () => ({
    userData: app.getPath("userData"),
    storeDir: store.getStoreDir(),
  }));

  const win = (e) => BrowserWindow.fromWebContents(e.sender);
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
