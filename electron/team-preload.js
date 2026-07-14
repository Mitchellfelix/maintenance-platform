const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ematTeam", {
  getUrl: () => ipcRenderer.invoke("team:get-url"),
  saveUrl: (url) => ipcRenderer.invoke("team:save-url", url),
});
