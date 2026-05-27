const { desktopCapturer, nativeImage } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const DEFAULT_INTERVAL_MS = 10000;
const DEFAULT_COOLDOWN_MS = 25000;
const THUMBNAIL_SIZE = { width: 640, height: 360 };
const PUDDLE_PROJECT_DIR = "C:\\Users\\PC\\Desktop\\PuddleProject";
const PUDDLE_PYTHON = "C:\\Users\\PC\\Desktop\\PuddleBuild\\.venv\\Scripts\\python.exe";

function normalizeInterval(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_INTERVAL_MS;
  }
  return Math.min(Math.max(Math.round(parsed), 5000), 60000);
}

function getOcrBridgePath() {
  const devPath = path.join(__dirname, "ocr", "puddle_ocr_bridge.py");
  if (fs.existsSync(devPath)) {
    return devPath;
  }

  const unpackedPath = path.join(process.resourcesPath ?? "", "app.asar.unpacked", "src", "ocr", "puddle_ocr_bridge.py");
  return fs.existsSync(unpackedPath) ? unpackedPath : null;
}

function getPuddleOcrCommand() {
  const bridgePath = getOcrBridgePath();
  if (!bridgePath || !fs.existsSync(PUDDLE_PYTHON) || !fs.existsSync(PUDDLE_PROJECT_DIR)) {
    return null;
  }
  return {
    command: PUDDLE_PYTHON,
    args: [bridgePath, "--project-dir", PUDDLE_PROJECT_DIR]
  };
}

async function captureScreenThumbnail() {
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: THUMBNAIL_SIZE,
    fetchWindowIcons: false
  });
  const source = sources.find((item) => !item.thumbnail.isEmpty()) ?? sources[0];
  if (!source || source.thumbnail.isEmpty()) {
    return null;
  }
  return source.thumbnail.resize(THUMBNAIL_SIZE);
}

function analyzePixels(image) {
  const size = image.getSize();
  const bitmap = image.getBitmap();
  const width = size.width;
  const height = size.height;
  const totals = {
    red: 0,
    green: 0,
    yellow: 0,
    bright: 0,
    dark: 0,
    blue: 0,
    pixels: 0
  };

  const regions = {
    top: { red: 0, yellow: 0, green: 0, pixels: 0 },
    bottom: { red: 0, yellow: 0, green: 0, pixels: 0 },
    center: { dark: 0, bright: 0, pixels: 0 }
  };

  for (let y = 0; y < height; y += 3) {
    for (let x = 0; x < width; x += 3) {
      const offset = (y * width + x) * 4;
      const b = bitmap[offset];
      const g = bitmap[offset + 1];
      const r = bitmap[offset + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const bright = (r + g + b) / 3;
      const isRed = r > 150 && r > g * 1.45 && r > b * 1.35;
      const isGreen = g > 135 && g > r * 1.2 && g > b * 1.15;
      const isYellow = r > 155 && g > 130 && b < 105;
      const isBlue = b > 145 && b > r * 1.2 && b > g * 1.05;
      const isBright = bright > 212 && max - min < 92;
      const isDark = bright < 48;

      totals.pixels += 1;
      if (isRed) totals.red += 1;
      if (isGreen) totals.green += 1;
      if (isYellow) totals.yellow += 1;
      if (isBlue) totals.blue += 1;
      if (isBright) totals.bright += 1;
      if (isDark) totals.dark += 1;

      const region = y < height * 0.22 ? regions.top : y > height * 0.73 ? regions.bottom : regions.center;
      region.pixels += 1;
      if (isRed) region.red += 1;
      if (isGreen) region.green += 1;
      if (isYellow) region.yellow += 1;
      if (isBright) region.bright += 1;
      if (isDark) region.dark += 1;
    }
  }

  return {
    redRatio: totals.red / totals.pixels,
    greenRatio: totals.green / totals.pixels,
    yellowRatio: totals.yellow / totals.pixels,
    blueRatio: totals.blue / totals.pixels,
    brightRatio: totals.bright / totals.pixels,
    darkRatio: totals.dark / totals.pixels,
    bottomRedRatio: regions.bottom.red / Math.max(regions.bottom.pixels, 1),
    bottomYellowRatio: regions.bottom.yellow / Math.max(regions.bottom.pixels, 1),
    topRedRatio: regions.top.red / Math.max(regions.top.pixels, 1),
    centerDarkRatio: regions.center.dark / Math.max(regions.center.pixels, 1),
    centerBrightRatio: regions.center.bright / Math.max(regions.center.pixels, 1)
  };
}

function runOcr(image) {
  const command = getPuddleOcrCommand();
  if (!command) {
    return Promise.resolve("");
  }

  const tempPath = path.join(os.tmpdir(), `mita-screen-${Date.now()}-${Math.random().toString(16).slice(2)}.png`);
  fs.writeFileSync(tempPath, image.toPNG());

  return new Promise((resolve) => {
    const child = spawn(command.command, [...command.args, tempPath], {
      windowsHide: true,
      timeout: 12000,
      cwd: PUDDLE_PROJECT_DIR
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString("utf8");
    });
    child.on("error", () => {
      fs.rm(tempPath, { force: true }, () => {});
      resolve("");
    });
    child.on("close", () => {
      fs.rm(tempPath, { force: true }, () => {});
      try {
        const parsed = JSON.parse(output.trim().split(/\r?\n/).at(-1) || "{}");
        resolve(String(parsed.text ?? ""));
      } catch {
        resolve(output.trim());
      }
    });
  });
}

function containsAny(text, values) {
  const normalized = text.toLowerCase();
  return values.some((value) => normalized.includes(value));
}

function pick(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function messageFromOcr(text, gameTips) {
  if (!text) {
    return null;
  }

  if (containsAny(text, ["error", "exception", "failed", "traceback", "cannot", "denied", "fatal"])) {
    return {
      category: "desktop-error",
      mode: "sad",
      message: pick(["That looks like an error...", "Want a tiny debug break?", "Something failed there."])
    };
  }
  if (containsAny(text, ["function", "const ", "let ", "class ", "npm", "git ", "terminal", "powershell", "visual studio", "vscode"])) {
    return {
      category: "coding",
      mode: "pray",
      message: pick(["Coding arc detected.", "Tiny rubber duck mode!", "That code is cooking."])
    };
  }
  if (containsAny(text, ["quest", "objective", "mission", "map", "inventory", "level", "xp"])) {
    return {
      category: "game-hud",
      mode: "wave",
      message: pick(["Quest marker maybe?", "Check the objective!", "Map brain says: look around."])
    };
  }
  if (gameTips && containsAny(text, ["health", "hp", "ammo", "shield", "mana", "revive", "defeat", "victory"])) {
    return {
      category: "game-tip",
      mode: "excited",
      message: pick(["Watch your HUD!", "Resources check!", "Tiny game tip: reposition?"])
    };
  }
  if (containsAny(text, ["menu", "settings", "options", "continue", "play", "pause"])) {
    return {
      category: "menu",
      mode: "idle",
      message: pick(["Menu time?", "Choosing screen spotted.", "Paused for strategy?"])
    };
  }
  return null;
}

function messageFromPixels(stats, gameTips) {
  if (gameTips && (stats.bottomRedRatio > 0.055 || stats.topRedRatio > 0.06)) {
    return {
      category: "low-health",
      mode: "sad",
      message: pick(["Low health vibes!", "Careful, red HUD!", "Maybe heal soon?"])
    };
  }
  if (gameTips && stats.bottomYellowRatio > 0.05) {
    return {
      category: "quest-marker",
      mode: "wave",
      message: pick(["Yellow marker spotted!", "Quest thingy maybe?", "Follow the shiny bit?"])
    };
  }
  if (stats.centerDarkRatio > 0.72 && stats.brightRatio > 0.018) {
    return {
      category: "coding-or-terminal",
      mode: "pray",
      message: pick(["Dark workspace focus mode.", "Terminal/coding vibes!", "You are locked in."])
    };
  }
  if (stats.blueRatio > 0.17 && stats.greenRatio > 0.08) {
    return {
      category: "game-or-media",
      mode: "wave",
      message: pick(["Looks like action on screen.", "I am watching respectfully.", "Screen looks busy!"])
    };
  }
  return {
    category: "desktop",
    mode: "idle",
    message: pick(["I see what you're doing~", "Desktop watch mode on.", "Still here with you."])
  };
}

async function analyzeCurrentScreen(settings) {
  const image = await captureScreenThumbnail();
  if (!image) {
    return null;
  }
  const stats = analyzePixels(image);
  const ocrText = settings.screenOcrEnabled ? await runOcr(image) : "";
  const ocrMessage = messageFromOcr(ocrText, settings.gameTips);
  return {
    ...(ocrMessage ?? messageFromPixels(stats, settings.gameTips)),
    stats,
    usedOcr: Boolean(ocrText)
  };
}

module.exports = {
  DEFAULT_INTERVAL_MS,
  DEFAULT_COOLDOWN_MS,
  analyzeCurrentScreen,
  normalizeInterval,
  getPuddleOcrCommand
};
