const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, safeStorage, screen } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { askOpenAIVision } = require("./openai-vision");
const { askMitaVoice, createMitaSpeech, transcribeAudio } = require("./openai-voice");
const {
  DEFAULT_OPENAI_MODEL,
  DEFAULT_VISION_SETTINGS,
  canMakeVisionRequest,
  maskApiKey,
  normalizeVisionSettings,
  recordVisionRequest,
  resetUsageCounters
} = require("./vision-core");
const {
  DEFAULT_VOICE_SETTINGS,
  canMakeVoiceRequest,
  normalizeVoiceSettings,
  recordVoiceRequest,
  resetVoiceUsageCounters
} = require("./voice-core");

const WINDOW_WIDTH = 560;
const WINDOW_HEIGHT = 560;
const MOVE_STEP_MS = 16;
const RANDOM_ACTION_MIN_MS = 4500;
const RANDOM_ACTION_MAX_MS = 12000;
const MENU_MODES = [
  ["idle", "Idle"],
  ["walk", "Walk"],
  ["wave", "Wave"],
  ["excited", "Excited"],
  ["sad", "Sad"],
  ["pray", "Pray"],
  ["shy", "Shy"]
];

let mainWindow = null;
let settingsWindow = null;
let voiceSettingsWindow = null;
let tray = null;
let settings = {};
let randomActionTimer = null;
let moveTimer = null;
let currentMove = null;
let autoVisionTimer = null;
let autoVisionIntervalSeconds = null;
let nextAutoVisionAt = null;
let lastAutoVisionStatus = "off";
let visionBusy = false;
let voiceBusy = false;
let isRecording = false;
let isTranscribing = false;
let isThinking = false;
let isSpeaking = false;
let voiceKeyWatcher = null;
let clickThroughEnabled = false;
let bubbleVisible = false;
let cleanCaptureState = null;
let visionMemory = [];

const assetsDir = path.join(__dirname, "..", "assets");
const petManifestPath = path.join(assetsDir, "pet.json");
const settingsPath = () => path.join(app.getPath("userData"), "settings.json");

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function loadSettings() {
  const storedSettings = readJson(settingsPath(), {});
  for (const key of ["screen" + "Awareness", "game" + "Tips", "screen" + "OcrEnabled", "screen" + "CaptureIntervalMs", "screen" + "MessageCooldownMs"]) {
    delete storedSettings[key];
  }
  settings = normalizeVisionSettings({
    mode: "idle",
    position: null,
    startWithWindows: false,
    ...DEFAULT_VISION_SETTINGS,
    ...DEFAULT_VOICE_SETTINGS,
    ...storedSettings
  });
  settings = normalizeVoiceSettings(settings);
  if (!MENU_MODES.some(([mode]) => mode === settings.mode)) {
    settings.mode = "idle";
  }
}

function saveSettings() {
  writeJson(settingsPath(), settings);
}

function encryptApiKey(apiKey) {
  const value = String(apiKey || "").trim();
  if (!value) {
    delete settings.openaiApiKeyEncrypted;
    return;
  }
  if (safeStorage.isEncryptionAvailable()) {
    settings.openaiApiKeyEncrypted = {
      type: "safeStorage",
      value: safeStorage.encryptString(value).toString("base64")
    };
  } else {
    settings.openaiApiKeyEncrypted = {
      type: "base64",
      value: Buffer.from(value, "utf8").toString("base64")
    };
  }
}

function getApiKey() {
  const stored = settings.openaiApiKeyEncrypted;
  if (!stored?.value) {
    return "";
  }
  try {
    if (stored.type === "safeStorage" && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(stored.value, "base64"));
    }
    if (stored.type === "base64") {
      return Buffer.from(stored.value, "base64").toString("utf8");
    }
  } catch {
    return "";
  }
  return "";
}

function hasApiKey() {
  return Boolean(getApiKey());
}

function getVisionSettingsPayload(firstRun = false) {
  const apiKey = getApiKey();
  return {
    firstRun,
    settings: {
      openaiModel: settings.openaiModel || DEFAULT_OPENAI_MODEL,
      visionEnabled: Boolean(settings.visionEnabled),
      autoVisionEnabled: Boolean(settings.autoVisionEnabled),
      autoScanIntervalSeconds: settings.autoScanIntervalSeconds,
      visionCooldownSeconds: settings.visionCooldownSeconds,
      dailyRequestCap: settings.dailyRequestCap,
      weeklyRequestCap: settings.weeklyRequestCap,
      maxImageWidth: settings.maxImageWidth,
      jpegQuality: settings.jpegQuality,
      imageDetail: settings.imageDetail,
      usage: settings.usage,
      captureMode: settings.captureMode,
      hidePetDuringCapture: settings.hidePetDuringCapture,
      hideBubblesDuringCapture: settings.hideBubblesDuringCapture,
      skipAutoScanWhenBubbleVisible: settings.skipAutoScanWhenBubbleVisible,
      bubbleDurationMs: settings.bubbleDurationMs,
      bubbleFadeMs: settings.bubbleFadeMs,
      captureDelayMs: settings.captureDelayMs,
      autoVisionActive: Boolean(autoVisionTimer || (settings.autoVisionEnabled && lastAutoVisionStatus !== "off")),
      activeAutoScanIntervalSeconds: autoVisionIntervalSeconds,
      nextAutoVisionAt,
      lastAutoVisionStatus,
      hasApiKey: Boolean(apiKey),
      maskedApiKey: maskApiKey(apiKey)
    }
  };
}

function getVoiceSettingsPayload() {
  return {
    settings: {
      voiceModeEnabled: Boolean(settings.voiceModeEnabled),
      pushToTalkKey: settings.pushToTalkKey,
      voiceChatModel: settings.voiceChatModel || DEFAULT_VOICE_SETTINGS.voiceChatModel,
      sttModel: settings.sttModel || DEFAULT_VOICE_SETTINGS.sttModel,
      ttsEnabled: Boolean(settings.ttsEnabled),
      ttsModel: settings.ttsModel || DEFAULT_VOICE_SETTINGS.ttsModel,
      ttsVoice: settings.ttsVoice || DEFAULT_VOICE_SETTINGS.ttsVoice,
      maxRecordingSeconds: settings.maxRecordingSeconds,
      minRecordingMs: settings.minRecordingMs,
      voiceDailyRequestCap: settings.voiceDailyRequestCap,
      voiceWeeklyRequestCap: settings.voiceWeeklyRequestCap,
      voiceCooldownMs: settings.voiceCooldownMs,
      voiceLanguage: settings.voiceLanguage,
      voiceReplyMaxTokens: settings.voiceReplyMaxTokens,
      voiceUsage: settings.voiceUsage,
      hasApiKey: hasApiKey(),
      voiceBusy,
      isRecording,
      isTranscribing,
      isThinking,
      isSpeaking
    }
  };
}

function getDefaultPosition() {
  const display = screen.getPrimaryDisplay();
  const area = display.workArea;
  return {
    x: Math.round(area.x + area.width - WINDOW_WIDTH - 24),
    y: Math.round(area.y + area.height - WINDOW_HEIGHT - 18)
  };
}

function getSafePosition(position) {
  const displays = screen.getAllDisplays();
  const candidate = position ?? getDefaultPosition();
  const display = displays.find((item) => {
    const area = item.workArea;
    return (
      candidate.x >= area.x - WINDOW_WIDTH &&
      candidate.x <= area.x + area.width &&
      candidate.y >= area.y - WINDOW_HEIGHT &&
      candidate.y <= area.y + area.height
    );
  }) ?? screen.getPrimaryDisplay();

  const area = display.workArea;
  return {
    x: Math.min(Math.max(candidate.x, area.x), area.x + area.width - WINDOW_WIDTH),
    y: Math.min(Math.max(candidate.y, area.y), area.y + area.height - WINDOW_HEIGHT)
  };
}

function buildIcon() {
  const image = nativeImage.createFromPath(path.join(assetsDir, "spritesheet.webp"));
  return image.isEmpty() ? nativeImage.createEmpty() : image.resize({ width: 16, height: 16 });
}

function createContextMenu() {
  const startChecked = app.getLoginItemSettings().openAtLogin || settings.startWithWindows;
  const keyExists = hasApiKey();
  return Menu.buildFromTemplate([
    {
      label: "Modus",
      submenu: MENU_MODES.map(([mode, label]) => ({
        label,
        type: "radio",
        checked: settings.mode === mode,
        click: () => setMode(mode, true)
      }))
    },
    { type: "separator" },
    {
      label: `Vision Mode: ${settings.visionEnabled ? "On" : "Off"}`,
      type: "checkbox",
      checked: Boolean(settings.visionEnabled),
      click: (menuItem) => toggleVisionMode(menuItem.checked)
    },
    {
      label: settings.autoVisionEnabled
        ? `Auto Vision: On (${settings.autoScanIntervalSeconds}s)`
        : "Auto Vision: Off",
      type: "checkbox",
      enabled: Boolean(settings.visionEnabled && keyExists),
      checked: Boolean(settings.autoVisionEnabled),
      click: (menuItem) => toggleAutoVision(menuItem.checked)
    },
    {
      label: "Ask Mita what she sees",
      enabled: true,
      click: () => runVisionRequest({ manual: true })
    },
    {
      label: "Open Vision Settings",
      click: () => openVisionSettings(false)
    },
    {
      label: "Clear API Key",
      enabled: keyExists,
      click: clearApiKey
    },
    { type: "separator" },
    {
      label: `Voice Mode: ${settings.voiceModeEnabled ? "On" : "Off"}`,
      type: "checkbox",
      checked: Boolean(settings.voiceModeEnabled),
      click: (menuItem) => toggleVoiceMode(menuItem.checked)
    },
    {
      label: `Mita Voice Output: ${settings.ttsEnabled ? "On" : "Off"}`,
      type: "checkbox",
      checked: Boolean(settings.ttsEnabled),
      click: (menuItem) => toggleVoiceOutput(menuItem.checked)
    },
    {
      label: "Open Voice Settings",
      click: () => openVoiceSettings()
    },
    {
      label: "Test Microphone",
      enabled: Boolean(settings.voiceModeEnabled),
      click: () => beginVoiceRecording({ test: true })
    },
    {
      label: "Test Mita Voice",
      click: () => testMitaVoice()
    },
    { type: "separator" },
    {
      label: "Unten rechts",
      click: () => {
        stopMove();
        const position = getDefaultPosition();
        mainWindow?.setPosition(position.x, position.y);
        persistWindowPosition();
      }
    },
    {
      label: "Mit Windows starten",
      type: "checkbox",
      checked: startChecked,
      click: (menuItem) => toggleStartWithWindows(menuItem.checked)
    },
    { type: "separator" },
    {
      label: "Beenden",
      click: () => app.quit()
    }
  ]);
}

function updateMenus() {
  tray?.setContextMenu(createContextMenu());
}

function emitSettings() {
  const payload = getVisionSettingsPayload(false).settings;
  mainWindow?.webContents.send("pet:settings", payload);
  settingsWindow?.webContents.send("vision:settings", getVisionSettingsPayload(false));
  voiceSettingsWindow?.webContents.send("voice:settings", getVoiceSettingsPayload());
}

function showContextMenu() {
  Menu.setApplicationMenu(null);
  createContextMenu().popup({ window: mainWindow ?? undefined });
}

function createTray() {
  tray = new Tray(buildIcon());
  tray.setToolTip("MitaDesktopPet");
  tray.setContextMenu(createContextMenu());
  tray.on("click", () => mainWindow?.show());
}

function createWindow() {
  const manifest = readJson(petManifestPath, {
    displayName: "MitaPet",
    description: "Desktop pet"
  });
  const position = getSafePosition(settings.position);

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: position.x,
    y: position.y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === "media");
  });
  mainWindow.loadFile(path.join(__dirname, "renderer.html"));

  mainWindow.webContents.once("did-finish-load", () => {
    mainWindow.webContents.send("pet:init", {
      manifest,
      mode: settings.mode,
      spritesheetUrl: pathToFileUrl(path.join(assetsDir, manifest.spritesheetPath ?? "spritesheet.webp"))
    });
    scheduleRandomAction();
    startAutoVisionIfEnabled();
    startVoiceKeyWatcher();
    setTimeout(() => setClickThrough(true), 250);
    if (!settings.visionSetupSeen) {
      setTimeout(() => openVisionSettings(true), 600);
    }
  });

  mainWindow.on("moved", persistWindowPosition);
  mainWindow.on("closed", () => {
    mainWindow = null;
    clearTimeout(randomActionTimer);
    stopAutoVision();
    stopVoiceKeyWatcher();
    stopMove();
  });
}

function pathToFileUrl(filePath) {
  return `file:///${filePath.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1:")}`;
}

function openVisionSettings(firstRun) {
  if (settingsWindow) {
    settingsWindow.focus();
    settingsWindow.webContents.send("vision:settings", getVisionSettingsPayload(firstRun));
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 560,
    height: firstRun ? 680 : 760,
    title: "Mita Vision Settings",
    resizable: true,
    minimizable: true,
    maximizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  settingsWindow.loadFile(path.join(__dirname, "vision-settings.html"));
  settingsWindow.webContents.once("did-finish-load", () => {
    settingsWindow?.webContents.send("vision:settings", getVisionSettingsPayload(firstRun));
  });
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}

function openVoiceSettings() {
  if (voiceSettingsWindow) {
    voiceSettingsWindow.focus();
    voiceSettingsWindow.webContents.send("voice:settings", getVoiceSettingsPayload());
    return;
  }
  voiceSettingsWindow = new BrowserWindow({
    width: 560,
    height: 780,
    title: "Mita Voice Settings",
    resizable: true,
    minimizable: true,
    maximizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  voiceSettingsWindow.loadFile(path.join(__dirname, "voice-settings.html"));
  voiceSettingsWindow.webContents.once("did-finish-load", () => {
    voiceSettingsWindow?.webContents.send("voice:settings", getVoiceSettingsPayload());
  });
  voiceSettingsWindow.on("closed", () => {
    voiceSettingsWindow = null;
  });
}

function setMode(mode, persist) {
  if (persist) {
    settings.mode = mode;
    saveSettings();
    updateMenus();
  }
  mainWindow?.webContents.send("pet:mode", mode);
}

function toggleStartWithWindows(enabled) {
  settings.startWithWindows = enabled;
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath
  });
  saveSettings();
  updateMenus();
}

function toggleVisionMode(enabled) {
  settings.visionEnabled = enabled;
  if (!enabled) {
    settings.autoVisionEnabled = false;
    stopAutoVision();
  }
  settings.visionSetupSeen = true;
  saveSettings();
  updateMenus();
  emitSettings();
  if (enabled && !hasApiKey()) {
    sendBubble("Add your OpenAI API key in Vision Settings first.", "wave");
    openVisionSettings(false);
  } else {
    sendBubble(enabled ? "OpenAI Vision Mode on." : "Vision Mode off.", enabled ? "excited" : "idle");
  }
}

function toggleVoiceMode(enabled) {
  settings = normalizeVoiceSettings({
    ...settings,
    voiceModeEnabled: enabled
  });
  saveSettings();
  updateMenus();
  emitSettings();
  if (enabled) {
    startVoiceKeyWatcher();
    if (!hasApiKey()) {
      sendManualBubble("Add your OpenAI API key first.", "wave", { priority: true });
      openVoiceSettings();
    } else {
      sendManualBubble(`Voice Mode on. Hold ${settings.pushToTalkKey} to talk.`, "excited", { priority: true });
    }
  } else {
    stopVoiceKeyWatcher();
    sendBubble("Voice Mode off.", "idle", { priority: true });
  }
}

function toggleVoiceOutput(enabled) {
  settings = normalizeVoiceSettings({
    ...settings,
    ttsEnabled: enabled
  });
  saveSettings();
  updateMenus();
  emitSettings();
  sendBubble(enabled ? "Mita voice output on." : "Mita voice output off.", enabled ? "wave" : "idle", { priority: true });
}

function toggleAutoVision(enabled) {
  if (enabled && (!settings.visionEnabled || !hasApiKey())) {
    sendBubble("Add your OpenAI API key in Vision Settings first.", "wave");
    openVisionSettings(false);
    return;
  }
  settings.autoVisionEnabled = enabled;
  saveSettings();
  updateMenus();
  emitSettings();
  if (enabled) {
    startAutoVisionIfEnabled();
    sendBubble(`Auto Vision on: every ${settings.autoScanIntervalSeconds}s.`, "pray");
  } else {
    stopAutoVision();
    sendBubble("Auto Vision off.", "idle");
  }
}

function applyVoiceSettings(payload) {
  settings = normalizeVoiceSettings({
    ...settings,
    ...(payload ?? {})
  });
  saveSettings();
  updateMenus();
  emitSettings();
  if (settings.voiceModeEnabled) {
    startVoiceKeyWatcher();
  } else {
    stopVoiceKeyWatcher();
  }
  return getVoiceSettingsPayload();
}

function clearApiKey() {
  delete settings.openaiApiKeyEncrypted;
  settings.autoVisionEnabled = false;
  saveSettings();
  stopAutoVision();
  updateMenus();
  emitSettings();
  sendBubble("API key cleared.", "idle");
}

function applyVisionSettings(payload) {
  const { openaiApiKey, closeAfterSave: _closeAfterSave, ...settingPayload } = payload ?? {};
  const previousKey = getApiKey();
  const next = normalizeVisionSettings({
    ...settings,
    ...settingPayload
  });
  settings = {
    ...settings,
    ...next,
    openaiApiKeyEncrypted: settings.openaiApiKeyEncrypted
  };
  if (typeof openaiApiKey === "string" && openaiApiKey.trim()) {
    encryptApiKey(openaiApiKey);
  } else if (!previousKey && openaiApiKey === "") {
    delete settings.openaiApiKeyEncrypted;
  }
  if (!settings.visionEnabled) {
    settings.autoVisionEnabled = false;
  }
  settings.visionSetupSeen = true;
  saveSettings();
  updateMenus();
  emitSettings();
  startAutoVisionIfEnabled();
  return getVisionSettingsPayload(false);
}

function skipVisionSetup() {
  settings.visionSetupSeen = true;
  saveSettings();
  updateMenus();
  emitSettings();
}

function startAutoVisionIfEnabled() {
  stopAutoVision();
  if (!settings.visionEnabled || !settings.autoVisionEnabled || !hasApiKey()) {
    lastAutoVisionStatus = "off";
    return;
  }
  const intervalSeconds = settings.autoScanIntervalSeconds;
  const intervalMs = intervalSeconds * 1000;
  autoVisionIntervalSeconds = intervalSeconds;
  lastAutoVisionStatus = `waiting ${intervalSeconds}s`;
  scheduleAutoVision(intervalMs);
  emitSettings();
}

function scheduleAutoVision(delayMs) {
  if (autoVisionTimer) {
    clearTimeout(autoVisionTimer);
  }
  nextAutoVisionAt = Date.now() + delayMs;
  autoVisionTimer = setTimeout(runAutoVisionTick, delayMs);
}

async function runAutoVisionTick() {
  autoVisionTimer = null;
  nextAutoVisionAt = null;

  if (!settings.visionEnabled || !settings.autoVisionEnabled || !hasApiKey()) {
    lastAutoVisionStatus = "off";
    emitSettings();
    return;
  }

  if (visionBusy) {
    lastAutoVisionStatus = "busy, retrying";
    scheduleAutoVision(2000);
    emitSettings();
    return;
  }
  if (voiceBusy) {
    lastAutoVisionStatus = "voice busy, retrying";
    scheduleAutoVision(2000);
    emitSettings();
    return;
  }

  lastAutoVisionStatus = "checking screen";
  emitSettings();
  await runVisionRequest({ manual: false, priority: true });

  if (settings.visionEnabled && settings.autoVisionEnabled && hasApiKey()) {
    const intervalMs = settings.autoScanIntervalSeconds * 1000;
    autoVisionIntervalSeconds = settings.autoScanIntervalSeconds;
    lastAutoVisionStatus = `waiting ${settings.autoScanIntervalSeconds}s`;
    scheduleAutoVision(intervalMs);
    emitSettings();
  }
}

function stopAutoVision() {
  if (autoVisionTimer) {
    clearTimeout(autoVisionTimer);
    autoVisionTimer = null;
  }
  autoVisionIntervalSeconds = null;
  nextAutoVisionAt = null;
  lastAutoVisionStatus = "off";
  visionBusy = false;
}

function sendBubble(message, mode, options = {}) {
  if (!message || !mainWindow) {
    return;
  }
  mainWindow.webContents.send("pet:bubble", {
    message,
    mode,
    durationMs: settings.bubbleDurationMs,
    manual: false,
    priority: Boolean(options.priority)
  });
}

function sendManualBubble(message, mode, options = {}) {
  if (!message || !mainWindow) {
    return;
  }
  mainWindow.webContents.send("pet:bubble", {
    message,
    mode,
    durationMs: settings.bubbleDurationMs,
    manual: true,
    priority: options.priority !== false
  });
}

function setClickThrough(enabled) {
  if (!mainWindow || mainWindow.isDestroyed() || clickThroughEnabled === enabled) {
    return;
  }
  clickThroughEnabled = enabled;
  mainWindow.setIgnoreMouseEvents(enabled, { forward: true });
}

function getVirtualKeyCode(key) {
  const upper = String(key || "F8").trim().toUpperCase();
  const functionKey = upper.match(/^F([1-9]|1[0-9]|2[0-4])$/);
  if (functionKey) {
    return 0x70 + Number(functionKey[1]) - 1;
  }
  if (/^[A-Z]$/.test(upper) || /^[0-9]$/.test(upper)) {
    return upper.charCodeAt(0);
  }
  if (upper === "SPACE") {
    return 0x20;
  }
  return 0x77;
}

function startVoiceKeyWatcher() {
  stopVoiceKeyWatcher();
  if (!settings.voiceModeEnabled || !mainWindow) {
    return;
  }

  const keyCode = getVirtualKeyCode(settings.pushToTalkKey);
  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class KeyState {
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey);
}
"@
$key = ${keyCode}
$wasDown = $false
while ($true) {
  $down = ([KeyState]::GetAsyncKeyState($key) -band 0x8000) -ne 0
  if ($down -ne $wasDown) {
    if ($down) { [Console]::Out.WriteLine("down") } else { [Console]::Out.WriteLine("up") }
    [Console]::Out.Flush()
    $wasDown = $down
  }
  Start-Sleep -Milliseconds 25
}`;

  try {
    voiceKeyWatcher = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"]
    });
    let buffer = "";
    voiceKeyWatcher.stdout.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim() === "down") {
          beginVoiceRecording();
        } else if (line.trim() === "up") {
          endVoiceRecording();
        }
      }
    });
    voiceKeyWatcher.on("exit", () => {
      voiceKeyWatcher = null;
    });
  } catch {
    voiceKeyWatcher = null;
    sendBubble("Push-to-talk watcher could not start.", "sad", { priority: true });
  }
}

function stopVoiceKeyWatcher() {
  if (!voiceKeyWatcher) {
    return;
  }
  const watcher = voiceKeyWatcher;
  voiceKeyWatcher = null;
  try {
    watcher.kill();
  } catch {
    // Ignore watcher shutdown races.
  }
}

function voiceErrorMessage(reason) {
  return {
    "voice-disabled": "Turn Voice Mode on first.",
    "missing-api-key": "Add your OpenAI API key first.",
    "daily-cap": "Voice budget reached for today.",
    "weekly-cap": "Voice budget reached for this week.",
    cooldown: "Tiny cooldown, try again in a sec."
  }[reason] || "Voice is not ready.";
}

function mapVoiceEmotion(emotion) {
  return {
    happy: "excited",
    shy: "shy",
    excited: "excited",
    sad: "sad",
    pray: "pray",
    sleep: "idle",
    idle: "idle"
  }[emotion] || "idle";
}

function beginVoiceRecording(options = {}) {
  if (voiceBusy || isRecording || isTranscribing || isThinking || isSpeaking) {
    return;
  }
  const check = canMakeVoiceRequest(settings, hasApiKey());
  settings = check.settings;
  saveSettings();
  emitSettings();
  if (!check.ok) {
    sendManualBubble(voiceErrorMessage(check.reason), check.reason.includes("cap") ? "sad" : "wave", { priority: true });
    if (check.reason === "missing-api-key") {
      openVoiceSettings();
    }
    return;
  }

  voiceBusy = true;
  isRecording = true;
  emitSettings();
  sendManualBubble(options.test ? "Mic test: hold and talk." : "Listening...", "pray", { priority: true });
  mainWindow?.webContents.send("voice:start-recording", {
    maxRecordingSeconds: settings.maxRecordingSeconds
  });
}

function endVoiceRecording() {
  if (!isRecording) {
    return;
  }
  mainWindow?.webContents.send("voice:stop-recording");
}

function resetVoiceState() {
  voiceBusy = false;
  isRecording = false;
  isTranscribing = false;
  isThinking = false;
  isSpeaking = false;
  emitSettings();
}

async function handleVoiceRecordingComplete(payload = {}) {
  const durationMs = Number(payload.durationMs || 0);
  const bytes = Array.isArray(payload.bytes) ? payload.bytes : [];
  isRecording = false;

  if (durationMs < settings.minRecordingMs || bytes.length === 0) {
    sendManualBubble("I couldn't hear that.", "shy", { priority: true });
    resetVoiceState();
    return;
  }

  const check = canMakeVoiceRequest(settings, hasApiKey());
  settings = check.settings;
  if (!check.ok) {
    sendManualBubble(voiceErrorMessage(check.reason), check.reason.includes("cap") ? "sad" : "wave", { priority: true });
    saveSettings();
    resetVoiceState();
    return;
  }

  try {
    settings = recordVoiceRequest(settings);
    saveSettings();
    isTranscribing = true;
    emitSettings();
    sendManualBubble("Transcribing...", "pray", { priority: true });
    const transcript = await transcribeAudio({
      apiKey: getApiKey(),
      settings,
      audioBuffer: Buffer.from(bytes),
      mimeType: payload.mimeType || "audio/webm"
    });
    isTranscribing = false;

    if (!transcript) {
      sendManualBubble("I couldn't hear that clearly.", "shy", { priority: true });
      resetVoiceState();
      return;
    }

    isThinking = true;
    emitSettings();
    sendManualBubble("Thinking...", "pray", { priority: true });
    const reply = await askMitaVoice({
      apiKey: getApiKey(),
      settings,
      transcript
    });
    isThinking = false;

    if (reply.should_speak && reply.reply) {
      const mode = mapVoiceEmotion(reply.emotion);
      temporaryMode(mode, 1600);
      sendManualBubble(reply.reply, mode, { priority: true });
      if (settings.ttsEnabled) {
        try {
          isSpeaking = true;
          emitSettings();
          const audioBase64 = await createMitaSpeech({
            apiKey: getApiKey(),
            settings,
            text: reply.reply
          });
          mainWindow?.webContents.send("voice:play-audio", {
            base64: audioBase64,
            mimeType: "audio/mpeg"
          });
        } catch {
          isSpeaking = false;
          emitSettings();
        }
      }
    }
  } catch (error) {
    const message = error.statusCode === 400
      ? "Voice model failed. Check Voice Settings."
      : "Voice request failed.";
    sendManualBubble(message, "sad", { priority: true });
  } finally {
    if (!isSpeaking) {
      resetVoiceState();
    } else {
      isRecording = false;
      isTranscribing = false;
      isThinking = false;
      emitSettings();
    }
  }
}

async function testMitaVoice() {
  if (!hasApiKey()) {
    sendManualBubble("Add your OpenAI API key first.", "wave", { priority: true });
    openVoiceSettings();
    return;
  }
  if (!settings.ttsEnabled) {
    sendManualBubble("Mita voice output is off.", "idle", { priority: true });
    return;
  }
  try {
    isSpeaking = true;
    emitSettings();
    const text = "Mita voice test! Hi hi~";
    sendManualBubble(text, "wave", { priority: true });
    const audioBase64 = await createMitaSpeech({
      apiKey: getApiKey(),
      settings,
      text
    });
    mainWindow?.webContents.send("voice:play-audio", {
      base64: audioBase64,
      mimeType: "audio/mpeg"
    });
  } catch {
    isSpeaking = false;
    emitSettings();
    sendManualBubble("Voice output failed. Check Voice Settings.", "sad", { priority: true });
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function beginCleanCapture() {
  cleanCaptureState = {
    wasPetVisible: Boolean(mainWindow?.isVisible()),
    wasSettingsVisible: Boolean(settingsWindow?.isVisible()),
    wasVoiceSettingsVisible: Boolean(voiceSettingsWindow?.isVisible())
  };

  if (settings.hideBubblesDuringCapture) {
    mainWindow?.webContents.send("pet:clear-bubble");
    bubbleVisible = false;
  }
  if (settings.hidePetDuringCapture) {
    mainWindow?.hide();
  }
  if (settingsWindow && cleanCaptureState.wasSettingsVisible) {
    settingsWindow.hide();
  }
  if (voiceSettingsWindow && cleanCaptureState.wasVoiceSettingsVisible) {
    voiceSettingsWindow.hide();
  }

  await delay(settings.captureDelayMs);
}

async function endCleanCapture() {
  if (!cleanCaptureState) {
    return;
  }
  const { wasPetVisible, wasSettingsVisible, wasVoiceSettingsVisible } = cleanCaptureState;
  cleanCaptureState = null;
  if (settings.hidePetDuringCapture && wasPetVisible) {
    mainWindow?.showInactive();
  }
  if (settingsWindow && wasSettingsVisible) {
    settingsWindow.show();
  }
  if (voiceSettingsWindow && wasVoiceSettingsVisible) {
    voiceSettingsWindow.show();
  }
}

async function runVisionRequest({ manual, priority = false }) {
  if (visionBusy) {
    if (manual) {
      sendBubble("Vision is already thinking.", "pray");
    }
    return;
  }
  if (!manual && voiceBusy) {
    lastAutoVisionStatus = "voice busy, retrying";
    emitSettings();
    return;
  }
  if (!manual && !priority && settings.skipAutoScanWhenBubbleVisible && bubbleVisible) {
    lastAutoVisionStatus = "bubble visible, skipped";
    emitSettings();
    return;
  }

  let check = canMakeVisionRequest(settings, hasApiKey(), manual);
  settings = check.settings;
  saveSettings();

  if (!check.ok) {
    if (!manual) {
      lastAutoVisionStatus = check.reason;
      emitSettings();
    }
    if (manual || ["missing-api-key", "daily-cap", "weekly-cap"].includes(check.reason)) {
      const messages = {
        "vision-disabled": "Turn Vision Mode on first.",
        "missing-api-key": "Add your OpenAI API key in Vision Settings first.",
        "daily-cap": "Vision budget reached for today.",
        "weekly-cap": "Vision budget reached for this week.",
        cooldown: "Give me a tiny moment."
      };
      const sender = manual ? sendManualBubble : sendBubble;
      sender(messages[check.reason] || "Vision is not ready.", check.reason.includes("cap") ? "sad" : "wave");
      if (check.reason === "missing-api-key") {
        openVisionSettings(false);
      }
    }
    return;
  }

  visionBusy = true;
  try {
    settings = recordVisionRequest(settings);
    saveSettings();
    emitSettings();
    const { result } = await askOpenAIVision({
      apiKey: getApiKey(),
      settings: {
        ...settings,
        visionMemory,
        beforeCapture: beginCleanCapture,
        afterCapture: endCleanCapture
      }
    });
    rememberVisionResult(result);
    if (result.should_speak && result.tip) {
      temporaryMode(result.mode === "game" ? "excited" : result.mode === "terminal" || result.mode === "coding" ? "pray" : "wave", 1600);
      const sender = manual ? sendManualBubble : sendBubble;
      sender(result.tip, "wave", { priority: true });
    }
    if (!manual) {
      lastAutoVisionStatus = result.should_speak && result.tip ? "spoke" : "checked silently";
    }
  } catch (error) {
    const message = error.code === "capture-failed"
      ? "I couldn't see the screen."
      : error.statusCode === 400
        ? "OpenAI model setting seems invalid."
        : "Vision request failed.";
    const sender = manual ? sendManualBubble : sendBubble;
    sender(message, "sad", { priority: true });
    if (!manual) {
      lastAutoVisionStatus = error.code === "capture-failed" ? "capture failed" : "request failed";
    }
  } finally {
    visionBusy = false;
    if (!manual) {
      emitSettings();
    }
  }
}

function rememberVisionResult(result) {
  if (!result) {
    return;
  }
  visionMemory.push({
    at: new Date().toISOString(),
    mode: result.mode,
    seen: result.seen,
    details: result.important_details,
    tip: result.tip
  });
  visionMemory = visionMemory.slice(-6);
}

function persistWindowPosition() {
  if (!mainWindow || currentMove) {
    return;
  }
  const [x, y] = mainWindow.getPosition();
  settings.position = { x, y };
  saveSettings();
}

function scheduleRandomAction() {
  clearTimeout(randomActionTimer);
  const wait = RANDOM_ACTION_MIN_MS + Math.random() * (RANDOM_ACTION_MAX_MS - RANDOM_ACTION_MIN_MS);
  randomActionTimer = setTimeout(() => {
    if (!mainWindow) {
      return;
    }
    const roll = Math.random();
    if (roll < 0.34) {
      wander();
    } else if (roll < 0.48) {
      hop();
    } else {
      const actions = [
        ["idle", 2200],
        ["wave", 2600],
        ["excited", 2300],
        ["sad", 3000],
        ["pray", 3000],
        ["shy", 3000]
      ];
      const [mode, duration] = actions[Math.floor(Math.random() * actions.length)];
      temporaryMode(mode, duration);
    }
    scheduleRandomAction();
  }, wait);
}

function pickMoveMode(direction) {
  const base = Math.random() > 0.45 ? "walk" : "run";
  return `${base}-${direction > 0 ? "right" : "left"}`;
}

function restoreRestingMode() {
  const mode = settings.mode === "walk" ? "idle" : settings.mode;
  setMode(mode, false);
}

function stopMove() {
  if (moveTimer) {
    clearInterval(moveTimer);
    moveTimer = null;
  }
  currentMove = null;
}

function wander() {
  if (!mainWindow || currentMove) {
    return;
  }

  const [startX, startY] = mainWindow.getPosition();
  const display = screen.getDisplayNearestPoint({ x: startX, y: startY });
  const area = display.workArea;
  const distance = 80 + Math.random() * 180;
  const direction = Math.random() > 0.5 ? 1 : -1;
  const targetX = Math.min(Math.max(Math.round(startX + distance * direction), area.x), area.x + area.width - WINDOW_WIDTH);
  const targetY = Math.min(Math.max(Math.round(startY + (Math.random() - 0.5) * 40), area.y), area.y + area.height - WINDOW_HEIGHT);
  const durationMs = 1500 + Math.random() * 900;
  const startAt = Date.now();

  currentMove = { startX, startY, targetX, targetY, durationMs, startAt };
  setMode(pickMoveMode(direction), false);

  moveTimer = setInterval(() => {
    const t = Math.min((Date.now() - startAt) / durationMs, 1);
    const eased = 0.5 - Math.cos(t * Math.PI) / 2;
    const x = Math.round(startX + (targetX - startX) * eased);
    const y = Math.round(startY + (targetY - startY) * eased);
    mainWindow?.setPosition(x, y);
    if (t >= 1) {
      stopMove();
      settings.position = { x: targetX, y: targetY };
      saveSettings();
      restoreRestingMode();
    }
  }, MOVE_STEP_MS);
}

function hop() {
  temporaryMode("jumping", 1200);
  if (!mainWindow) {
    return;
  }
  const [x, y] = mainWindow.getPosition();
  let frame = 0;
  const frames = [0, -10, -22, -10, 0];
  const timer = setInterval(() => {
    mainWindow?.setPosition(x, y + frames[Math.min(frame, frames.length - 1)]);
    frame += 1;
    if (frame >= frames.length) {
      clearInterval(timer);
      mainWindow?.setPosition(x, y);
      persistWindowPosition();
    }
  }, 110);
}

function temporaryMode(mode, durationMs) {
  const previous = settings.mode;
  setMode(mode, false);
  setTimeout(() => setMode(previous, false), durationMs);
}

app.whenReady().then(() => {
  app.setName("MitaDesktopPet");
  loadSettings();
  createWindow();
  createTray();
});

app.on("window-all-closed", () => {
  // Keep the app alive from the tray/context menu until the user chooses Beenden.
});

app.on("before-quit", () => {
  stopVoiceKeyWatcher();
  persistWindowPosition();
});

ipcMain.on("pet:drag-start", () => {
  setClickThrough(false);
  stopMove();
});

ipcMain.on("pet:drag-end", (_event, position) => {
  settings.position = getSafePosition(position);
  saveSettings();
});

ipcMain.on("pet:context-menu", showContextMenu);
ipcMain.on("pet:clicked", () => temporaryMode("excited", 900));
ipcMain.on("pet:set-mode", (_event, mode) => setMode(mode, true));
ipcMain.on("pet:set-click-through", (_event, enabled) => setClickThrough(Boolean(enabled)));
ipcMain.on("pet:bubble-visible", (_event, visible) => {
  bubbleVisible = Boolean(visible);
});
ipcMain.on("pet:open-vision-settings", () => openVisionSettings(false));
ipcMain.on("pet:ask-vision", () => runVisionRequest({ manual: true }));
ipcMain.handle("vision:save", (event, payload) => {
  const result = applyVisionSettings(payload);
  event.sender.send("vision:settings", result);
  if (payload?.closeAfterSave) {
    setTimeout(() => {
      if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.close();
      }
    }, 80);
  }
  return result;
});
ipcMain.on("vision:skip-first-run", () => {
  skipVisionSetup();
  settingsWindow?.close();
});
ipcMain.on("vision:clear-api-key", () => clearApiKey());
ipcMain.on("vision:reset-usage", () => {
  settings = resetUsageCounters(settings);
  saveSettings();
  emitSettings();
});
ipcMain.on("pet:open-voice-settings", () => openVoiceSettings());
ipcMain.handle("voice:save", (event, payload) => {
  const result = applyVoiceSettings(payload);
  event.sender.send("voice:settings", result);
  return result;
});
ipcMain.on("voice:reset-usage", () => {
  settings = resetVoiceUsageCounters(settings);
  saveSettings();
  emitSettings();
});
ipcMain.on("voice:test-microphone", () => beginVoiceRecording({ test: true }));
ipcMain.on("voice:test-voice", () => testMitaVoice());
ipcMain.on("voice:recording-complete", (_event, payload) => {
  handleVoiceRecordingComplete(payload);
});
ipcMain.on("voice:recording-error", (_event, message) => {
  sendManualBubble(message || "Microphone could not start.", "sad", { priority: true });
  resetVoiceState();
});
ipcMain.on("voice:playback-ended", () => {
  isSpeaking = false;
  resetVoiceState();
});
ipcMain.handle("pet:get-state", () => ({
  settings: getVisionSettingsPayload(false).settings,
  voiceSettings: getVoiceSettingsPayload().settings,
  petManifestPath,
  assetsDir
}));
