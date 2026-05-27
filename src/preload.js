const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mitaPet", {
  onInit: (callback) => ipcRenderer.on("pet:init", (_event, payload) => callback(payload)),
  onMode: (callback) => ipcRenderer.on("pet:mode", (_event, mode) => callback(mode)),
  onBubble: (callback) => ipcRenderer.on("pet:bubble", (_event, payload) => callback(payload)),
  onSettings: (callback) => ipcRenderer.on("pet:settings", (_event, payload) => callback(payload)),
  dragStart: () => ipcRenderer.send("pet:drag-start"),
  dragEnd: (position) => ipcRenderer.send("pet:drag-end", position),
  openContextMenu: () => ipcRenderer.send("pet:context-menu"),
  clickReaction: () => ipcRenderer.send("pet:clicked"),
  setMode: (mode) => ipcRenderer.send("pet:set-mode", mode),
  toggleScreenAwareness: () => ipcRenderer.send("pet:toggle-screen-awareness"),
  toggleGameTips: () => ipcRenderer.send("pet:toggle-game-tips"),
  getState: () => ipcRenderer.invoke("pet:get-state")
});
