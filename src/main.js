const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, safeStorage, screen } = require("electron");
const fs = require("fs");
const path = require("path");
const { askOpenAIVision } = require("./openai-vision");
const {
  DEFAULT_OPENAI_MODEL,
  DEFAULT_VISION_SETTINGS,
  canMakeVisionRequest,
  maskApiKey,
  normalizeVisionSettings,
  recordVisionRequest,
  resetUsageCounters
} = require("./vision-core");

const WINDOW_WIDTH = 220;
const WINDOW_HEIGHT = 310;
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
let tray = null;
let settings = {};
let randomActionTimer = null;
let moveTimer = null;
let currentMove = null;
let autoVisionTimer = null;
let visionBusy = false;

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
    ...storedSettings
  });
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
      hasApiKey: Boolean(apiKey),
      maskedApiKey: maskApiKey(apiKey)
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
      label: `Auto Vision: ${settings.autoVisionEnabled ? "On" : "Off"}`,
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
  mainWindow.loadFile(path.join(__dirname, "renderer.html"));

  mainWindow.webContents.once("did-finish-load", () => {
    mainWindow.webContents.send("pet:init", {
      manifest,
      mode: settings.mode,
      spritesheetUrl: pathToFileUrl(path.join(assetsDir, manifest.spritesheetPath ?? "spritesheet.webp"))
    });
    scheduleRandomAction();
    startAutoVisionIfEnabled();
    if (!settings.visionSetupSeen) {
      setTimeout(() => openVisionSettings(true), 600);
    }
  });

  mainWindow.on("moved", persistWindowPosition);
  mainWindow.on("closed", () => {
    mainWindow = null;
    clearTimeout(randomActionTimer);
    stopAutoVision();
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
    sendBubble("Auto Vision on.", "pray");
  } else {
    stopAutoVision();
    sendBubble("Auto Vision off.", "idle");
  }
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
  const previousKey = getApiKey();
  const next = normalizeVisionSettings({
    ...settings,
    ...payload
  });
  settings = {
    ...settings,
    ...next,
    openaiApiKeyEncrypted: settings.openaiApiKeyEncrypted
  };
  if (typeof payload.openaiApiKey === "string" && payload.openaiApiKey.trim()) {
    encryptApiKey(payload.openaiApiKey);
  } else if (!previousKey && payload.openaiApiKey === "") {
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
    return;
  }
  autoVisionTimer = setInterval(() => {
    runVisionRequest({ manual: false });
  }, settings.autoScanIntervalSeconds * 1000);
}

function stopAutoVision() {
  if (autoVisionTimer) {
    clearInterval(autoVisionTimer);
    autoVisionTimer = null;
  }
  visionBusy = false;
}

function sendBubble(message, mode) {
  if (!message || !mainWindow) {
    return;
  }
  mainWindow.webContents.send("pet:bubble", { message, mode, durationMs: 4000 });
}

async function runVisionRequest({ manual }) {
  if (visionBusy) {
    if (manual) {
      sendBubble("Vision is already thinking.", "pray");
    }
    return;
  }

  let check = canMakeVisionRequest(settings, hasApiKey(), manual);
  settings = check.settings;
  saveSettings();

  if (!check.ok) {
    if (manual || ["missing-api-key", "daily-cap", "weekly-cap"].includes(check.reason)) {
      const messages = {
        "vision-disabled": "Turn Vision Mode on first.",
        "missing-api-key": "Add your OpenAI API key in Vision Settings first.",
        "daily-cap": "Vision budget reached for today.",
        "weekly-cap": "Vision budget reached for this week.",
        cooldown: "Give me a tiny moment."
      };
      sendBubble(messages[check.reason] || "Vision is not ready.", check.reason.includes("cap") ? "sad" : "wave");
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
      settings
    });
    if (result.should_speak && result.tip) {
      temporaryMode(result.mode === "game" ? "excited" : result.mode === "terminal" || result.mode === "coding" ? "pray" : "wave", 1600);
      sendBubble(result.tip, "wave");
    }
  } catch (error) {
    const message = error.code === "capture-failed"
      ? "I couldn't see the screen."
      : error.statusCode === 400
        ? "OpenAI model setting seems invalid."
        : "Vision request failed.";
    sendBubble(message, "sad");
  } finally {
    visionBusy = false;
  }
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
  persistWindowPosition();
});

ipcMain.on("pet:drag-start", () => {
  stopMove();
});

ipcMain.on("pet:drag-end", (_event, position) => {
  settings.position = getSafePosition(position);
  saveSettings();
});

ipcMain.on("pet:context-menu", showContextMenu);
ipcMain.on("pet:clicked", () => temporaryMode("excited", 900));
ipcMain.on("pet:set-mode", (_event, mode) => setMode(mode, true));
ipcMain.on("pet:open-vision-settings", () => openVisionSettings(false));
ipcMain.on("pet:ask-vision", () => runVisionRequest({ manual: true }));
ipcMain.on("vision:save", (event, payload) => {
  event.sender.send("vision:settings", applyVisionSettings(payload));
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
ipcMain.handle("pet:get-state", () => ({
  settings: getVisionSettingsPayload(false).settings,
  petManifestPath,
  assetsDir
}));
