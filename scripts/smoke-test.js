const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const requiredFiles = [
  "package.json",
  "src/main.js",
  "src/preload.js",
  "src/renderer.html",
  "src/renderer.js",
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
  "pet:context-menu"
]) {
  if (!mainSource.includes(expected)) {
    throw new Error(`Main process is missing: ${expected}`);
  }
}

const rendererSource = fs.readFileSync(path.join(root, "src/renderer.js"), "utf8");
for (const expected of ["idle", "walk", "sleep", "excited", "backgroundPosition"]) {
  if (!rendererSource.includes(expected)) {
    throw new Error(`Renderer is missing: ${expected}`);
  }
}

console.log("Smoke test passed: project files, pet manifest, sprite asset, and core desktop-pet features are present.");
