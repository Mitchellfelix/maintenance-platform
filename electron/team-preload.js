const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ematTeam", {
  getConfig: () => ipcRenderer.invoke("team:get-config"),
  getUrl: () => ipcRenderer.invoke("team:get-url"),
  saveConfig: (payload) => ipcRenderer.invoke("team:save-config", payload),
  saveUrl: (url) => ipcRenderer.invoke("team:save-url", url),
  submitSyncCredentials: (payload) => ipcRenderer.invoke("team:sync-credentials", payload),
});
