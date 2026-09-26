const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("alwajbahFS", {
  getPath: () => ipcRenderer.sendSync("fs:getPath"),
  setPath: (p) => ipcRenderer.sendSync("fs:setPath", String(p)),
  choosePath: () => ipcRenderer.sendSync("fs:choose"),
  stat: () => ipcRenderer.sendSync("fs:stat"),
  read: () => ipcRenderer.sendSync("fs:read"),
  write: (text) => ipcRenderer.sendSync("fs:write", String(text)),
});
