// تطبيق سطح المكتب (Electron) لنظام مدرسة الوجبة — يحفظ البيانات في ملف JSON مشترك على الشبكة.
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const fs = require("fs");
const path = require("path");

const configFile = () => path.join(app.getPath("userData"), "config.json");
function defaultPath() {
  const base = app.isPackaged ? path.dirname(process.execPath) : __dirname;
  return path.join(base, "alwajbah-data.json");
}
function readConfig() {
  try { return JSON.parse(fs.readFileSync(configFile(), "utf8")); } catch { return {}; }
}
let dataPath = null;
const current = () => dataPath || (dataPath = readConfig().dataPath || defaultPath());

ipcMain.on("fs:getPath", (e) => { e.returnValue = current(); });
ipcMain.on("fs:setPath", (e, p) => {
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    dataPath = p;
    fs.writeFileSync(configFile(), JSON.stringify({ dataPath: p }));
    e.returnValue = true;
  } catch { e.returnValue = false; }
});
ipcMain.on("fs:choose", (e) => {
  const r = dialog.showSaveDialogSync({
    title: "ملف بيانات النظام المشترك",
    defaultPath: current(),
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (r) { dataPath = r; fs.writeFileSync(configFile(), JSON.stringify({ dataPath: r })); }
  e.returnValue = r || null;
});
ipcMain.on("fs:stat", (e) => {
  try { e.returnValue = fs.statSync(current()).mtimeMs; } catch { e.returnValue = null; }
});
ipcMain.on("fs:read", (e) => {
  try { e.returnValue = fs.readFileSync(current(), "utf8"); } catch { e.returnValue = null; }
});
ipcMain.on("fs:write", (e, text) => {
  // كتابة ذرية: ملف مؤقت ثم استبدال
  const target = current();
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(tmp, text, "utf8");
    fs.renameSync(tmp, target);
    e.returnValue = true;
  } catch {
    try { fs.unlinkSync(tmp); } catch {}
    e.returnValue = false;
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 860,
    title: "مدرسة الوجبة الابتدائية",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
