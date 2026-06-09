const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("codexAccounts", {
  getState: () => ipcRenderer.invoke("profiles:getState"),
  switchProfile: (payload) => ipcRenderer.invoke("profiles:switch", payload),
  addProfile: (payload) => ipcRenderer.invoke("profiles:add", payload),
  cancelLogin: () => ipcRenderer.invoke("profiles:cancelLogin"),
  deleteProfile: (payload) => ipcRenderer.invoke("profiles:delete", payload),
  getAppVersion: () => ipcRenderer.invoke("app:getVersion"),
  closeApp: () => ipcRenderer.invoke("app:close"),
  onLoginOutput: (callback) => {
    const listener = (_event, text) => callback(text);
    ipcRenderer.on("login:output", listener);
    return () => ipcRenderer.removeListener("login:output", listener);
  },
});
