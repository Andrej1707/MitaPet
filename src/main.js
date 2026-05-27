const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen } = require("electron");
const fs = require("fs");
const path = require("path");

const PET_SIZE = 192;
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
let tray = null;
let settings = {};
let randomActionTimer = null;
let moveTimer = null;
let currentMove = null;

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
  settings = {
    mode: "idle",
    position: null,
    startWithWindows: false,
    ...readJson(settingsPath(), {})
  };
  if (!MENU_MODES.some(([mode]) => mode === settings.mode)) {
    settings.mode = "idle";
  }
}

function saveSettings() {
  writeJson(settingsPath(), settings);
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
  if (image.isEmpty()) {
    return nativeImage.createEmpty();
  }
  return image.resize({ width: 16, height: 16 });
}

function createContextMenu() {
  const startChecked = app.getLoginItemSettings().openAtLogin || settings.startWithWindows;
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

function showContextMenu() {
  Menu.setApplicationMenu(null);
  const menu = createContextMenu();
  menu.popup({ window: mainWindow ?? undefined });
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
  });

  mainWindow.on("moved", persistWindowPosition);
  mainWindow.on("closed", () => {
    mainWindow = null;
    clearTimeout(randomActionTimer);
    stopMove();
  });
}

function pathToFileUrl(filePath) {
  return `file:///${filePath.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1:")}`;
}

function setMode(mode, persist) {
  if (persist) {
    settings.mode = mode;
    saveSettings();
    tray?.setContextMenu(createContextMenu());
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
  tray?.setContextMenu(createContextMenu());
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

app.on("window-all-closed", (event) => {
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
ipcMain.handle("pet:get-state", () => ({
  settings,
  petManifestPath,
  assetsDir
}));
