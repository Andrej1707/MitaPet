const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const requiredFiles = [
  "package.json",
  "src/main.js",
  "src/preload.js",
  "src/renderer.html",
  "src/renderer.js",
  "src/openai-vision.js",
  "src/vision-core.js",
  "src/vision-settings.html",
  "src/vision-settings.js",
  "src/vision-settings.css",
  "src/styles.css",
  "assets/pet.json",
  "assets/spritesheet.webp"
];

for (const relativePath of requiredFiles) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, "assets/pet.json"), "utf8"));
if (manifest.id !== "mitapet") {
  throw new Error(`Unexpected pet id: ${manifest.id}`);
}
if (manifest.spritesheetPath !== "spritesheet.webp") {
  throw new Error(`Unexpected spritesheetPath: ${manifest.spritesheetPath}`);
}

const sheet = fs.statSync(path.join(root, "assets", manifest.spritesheetPath));
if (sheet.size < 100000) {
  throw new Error("spritesheet.webp looks too small to be a valid pet atlas");
}

const mainSource = fs.readFileSync(path.join(root, "src/main.js"), "utf8");
for (const expected of [
  "transparent: true",
  "frame: false",
  "alwaysOnTop: true",
  "setLoginItemSettings",
  "pet:context-menu",
  "Vision Mode",
  "Auto Vision",
  "Ask Mita what she sees",
  "openaiApiKeyEncrypted",
  "safeStorage",
  "runVisionRequest"
]) {
  if (!mainSource.includes(expected)) {
    throw new Error(`Main process is missing: ${expected}`);
  }
}

const rendererSource = fs.readFileSync(path.join(root, "src/renderer.js"), "utf8");
for (const expected of [
  "requestAnimationFrame",
  "accumulatedMs",
  "backgroundPosition",
  "FRAME_WIDTH",
  "FRAME_HEIGHT",
  "idle",
  "walk",
  "wave",
  "excited",
  "sad",
  "pray",
  "shy",
  "showBubble"
]) {
  if (!rendererSource.includes(expected)) {
    throw new Error(`Renderer is missing: ${expected}`);
  }
}

const rendererHtml = fs.readFileSync(path.join(root, "src/renderer.html"), "utf8");
if (!rendererHtml.includes("pet-bubble")) {
  throw new Error("Renderer markup is missing the bubble element");
}
if (!rendererHtml.includes("ask-vision") || !rendererHtml.includes("vision-settings")) {
  throw new Error("Renderer markup is missing vision controls");
}
if (rendererSource.includes("sleep") || rendererHtml.includes("sleep") || mainSource.includes("sleep")) {
  throw new Error("Sleep mode should not be exposed or referenced");
}
if (!rendererSource.includes("sad: { row: 6, frames: 6")) {
  throw new Error("Sad animation must use row 6 with 6 frames");
}

const visionSource = fs.readFileSync(path.join(root, "src/openai-vision.js"), "utf8");
for (const expected of [
  "desktopCapturer",
  "https://api.openai.com/v1/responses",
  "input_image",
  "json_schema",
  "getActiveWindowMetadata",
  "captureForVision"
]) {
  if (!visionSource.includes(expected)) {
    throw new Error(`OpenAI vision module is missing: ${expected}`);
  }
}

for (const forbidden of ["PaddleOCR", "puddle", "Ollama", "Gemma", "Qwen", "screen-awareness"]) {
  const files = ["package.json", "src/main.js", "src/openai-vision.js", "src/vision-core.js"];
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    if (source.toLowerCase().includes(forbidden.toLowerCase())) {
      throw new Error(`Forbidden local AI/OCR reference found in ${file}: ${forbidden}`);
    }
  }
}

const {
  canMakeVisionRequest,
  detectMode,
  maskApiKey,
  normalizeVisionSettings,
  parseVisionResult,
  recordVisionRequest
} = require("../src/vision-core");

const normalized = normalizeVisionSettings({});
if (normalized.openaiModel !== "gpt-5.4-nano" || normalized.visionEnabled !== false) {
  throw new Error("Vision defaults are incorrect");
}
if (maskApiKey("sk-test1234abcd") !== "sk-...abcd") {
  throw new Error("API key masking is incorrect");
}
if (detectMode({ processName: "RobloxPlayerBeta.exe", windowTitle: "Roblox" }) !== "game") {
  throw new Error("Game mode detection failed");
}
if (detectMode({ processName: "Code.exe", windowTitle: "main.js" }) !== "coding") {
  throw new Error("Coding mode detection failed");
}
if (detectMode({ processName: "powershell.exe", windowTitle: "PowerShell" }) !== "terminal") {
  throw new Error("Terminal mode detection failed");
}
if (detectMode({ processName: "chrome.exe", windowTitle: "YouTube" }) !== "video") {
  throw new Error("Video mode detection failed");
}
if (canMakeVisionRequest({ ...normalized, visionEnabled: true }, false, true).reason !== "missing-api-key") {
  throw new Error("Missing API key behavior failed");
}
if (!canMakeVisionRequest({ ...normalized, visionEnabled: false }, true, true).ok) {
  throw new Error("Manual Ask should be allowed with an API key");
}
const capped = { ...normalized, visionEnabled: true, usage: { ...normalized.usage, dailyCount: 500, weeklyCount: 0, lastDailyReset: new Date().toISOString().slice(0, 10) } };
if (canMakeVisionRequest(capped, true, true).reason !== "daily-cap") {
  throw new Error("Daily cap logic failed");
}
const requested = recordVisionRequest({ ...normalized, visionEnabled: true });
if (requested.usage.dailyCount !== 1 || requested.usage.weeklyCount !== 1) {
  throw new Error("Usage recording failed");
}
const parsed = parseVisionResult('{"mode":"coding","confidence":0.8,"seen":"test","important_details":["a"],"tip":"Looks good","should_speak":true}');
if (parsed.mode !== "coding" || parsed.tip !== "Looks good") {
  throw new Error("JSON parsing failed");
}
const fallback = parseVisionResult("plain fallback text");
if (!fallback.should_speak || !fallback.tip.includes("plain fallback")) {
  throw new Error("Invalid JSON fallback failed");
}

console.log("Smoke test passed: project files, pet manifest, sprite asset, and core desktop-pet features are present.");
