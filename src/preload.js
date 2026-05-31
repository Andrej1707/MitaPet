const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mitaPet", {
  onInit: (callback) => ipcRenderer.on("pet:init", (_event, payload) => callback(payload)),
  onMode: (callback) => ipcRenderer.on("pet:mode", (_event, mode) => callback(mode)),
  onBubble: (callback) => ipcRenderer.on("pet:bubble", (_event, payload) => callback(payload)),
  onClearBubble: (callback) => ipcRenderer.on("pet:clear-bubble", () => callback()),
  onSettings: (callback) => ipcRenderer.on("pet:settings", (_event, payload) => callback(payload)),
  dragStart: () => ipcRenderer.send("pet:drag-start"),
  dragEnd: (position) => ipcRenderer.send("pet:drag-end", position),
  openContextMenu: () => ipcRenderer.send("pet:context-menu"),
  clickReaction: () => ipcRenderer.send("pet:clicked"),
  setMode: (mode) => ipcRenderer.send("pet:set-mode", mode),
  setBubbleVisible: (visible) => ipcRenderer.send("pet:bubble-visible", visible),
  openVisionSettings: () => ipcRenderer.send("pet:open-vision-settings"),
  askVision: () => ipcRenderer.send("pet:ask-vision"),
  getState: () => ipcRenderer.invoke("pet:get-state")
});

contextBridge.exposeInMainWorld("mitaVision", {
  onSettings: (callback) => ipcRenderer.on("vision:settings", (_event, payload) => callback(payload)),
  save: (settings) => ipcRenderer.send("vision:save", settings),
  skipFirstRun: () => ipcRenderer.send("vision:skip-first-run"),
  clearApiKey: () => ipcRenderer.send("vision:clear-api-key"),
  resetUsage: () => ipcRenderer.send("vision:reset-usage")
});
