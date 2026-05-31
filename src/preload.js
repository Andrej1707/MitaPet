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
  setClickThrough: (enabled) => ipcRenderer.send("pet:set-click-through", enabled),
  setBubbleVisible: (visible) => ipcRenderer.send("pet:bubble-visible", visible),
  openVisionSettings: () => ipcRenderer.send("pet:open-vision-settings"),
  openVoiceSettings: () => ipcRenderer.send("pet:open-voice-settings"),
  askVision: () => ipcRenderer.send("pet:ask-vision"),
  getState: () => ipcRenderer.invoke("pet:get-state")
});

contextBridge.exposeInMainWorld("mitaVision", {
  onSettings: (callback) => ipcRenderer.on("vision:settings", (_event, payload) => callback(payload)),
  save: (settings) => ipcRenderer.invoke("vision:save", settings),
  skipFirstRun: () => ipcRenderer.send("vision:skip-first-run"),
  clearApiKey: () => ipcRenderer.send("vision:clear-api-key"),
  resetUsage: () => ipcRenderer.send("vision:reset-usage")
});

contextBridge.exposeInMainWorld("mitaVoice", {
  onSettings: (callback) => ipcRenderer.on("voice:settings", (_event, payload) => callback(payload)),
  save: (settings) => ipcRenderer.invoke("voice:save", settings),
  resetUsage: () => ipcRenderer.send("voice:reset-usage"),
  testMicrophone: () => ipcRenderer.send("voice:test-microphone"),
  testVoice: () => ipcRenderer.send("voice:test-voice"),
  onStartRecording: (callback) => ipcRenderer.on("voice:start-recording", (_event, payload) => callback(payload)),
  onStopRecording: (callback) => ipcRenderer.on("voice:stop-recording", () => callback()),
  recordingComplete: (payload) => ipcRenderer.send("voice:recording-complete", payload),
  recordingError: (message) => ipcRenderer.send("voice:recording-error", message),
  onPlayAudio: (callback) => ipcRenderer.on("voice:play-audio", (_event, payload) => callback(payload)),
  playbackEnded: () => ipcRenderer.send("voice:playback-ended")
});
