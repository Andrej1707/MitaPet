const FRAME_WIDTH = 192;
const FRAME_HEIGHT = 208;

const ANIMS = {
  idle: { row: 0, frames: 6, fps: 6 },
  run: { row: 1, frames: 8, fps: 10 },
  walk: { row: 1, frames: 8, fps: 10 },
  wave: { row: 3, frames: 4, fps: 6 },
  excited: { row: 4, frames: 5, fps: 8 },
  jumping: { row: 4, frames: 5, fps: 8 },
  sad: { row: 6, frames: 6, fps: 5 },
  pray: { row: 7, frames: 6, fps: 5 },
  shy: { row: 8, frames: 6, fps: 5 }
};

const BUBBLES = {
  idle: ["(^\u30fb\u03c9\u30fb^) Hiii~", "\u266a~"],
  run: ["Weeee~!", "Catch me!", "Hya!"],
  walk: ["Weeee~!", "Catch me!", "Hya!"],
  excited: ["KYAAA~!", "YAY!! \u2728", "SUGOI!!"],
  jumping: ["KYAAA~!", "YAY!! \u2728", "SUGOI!!"],
  sad: ["(\u00b4\uff1b\u03c9\uff1b`)", "sniff...", "uwaaaa..."],
  shy: [">///<", "h-huh...?", "\u3042\u306e..."],
  pray: ["\ud83d\ude4f", "Please...", "\u304a\u9858\u3044..."],
  wave: ["(^\u30fb\u03c9\u30fb^) Hiii~", "\u266a~"]
};

const shell = document.getElementById("pet-shell");
const hitbox = document.getElementById("pet-hitbox");
const sprite = document.getElementById("pet-sprite");
const bubble = document.getElementById("pet-bubble");
const menu = document.getElementById("pet-menu");
const nameEl = document.getElementById("pet-name");
const descriptionEl = document.getElementById("pet-description");
const screenAwarenessToggle = document.getElementById("screen-awareness-toggle");
const gameTipsToggle = document.getElementById("game-tips-toggle");

let animationFrameId = 0;
let lastFrameAt = 0;
let accumulatedMs = 0;
let frameIndex = 0;
let currentMode = "idle";
let drag = null;
let clickSuppressUntil = 0;
let bubbleTimer = 0;
let currentSettings = {
  screenAwareness: false,
  gameTips: false
};

function normalizeMode(mode) {
  if (mode === "walk-left" || mode === "walk-right") {
    return "walk";
  }
  if (mode === "run-left" || mode === "run-right") {
    return "run";
  }
  return ANIMS[mode] ? mode : "idle";
}

function isLeftFacing(mode) {
  return mode === "walk-left" || mode === "run-left";
}

function setFrame(row, frame) {
  sprite.style.backgroundPosition = `${-(frame * FRAME_WIDTH)}px ${-(row * FRAME_HEIGHT)}px`;
}

function setModeClasses(mode, normalizedMode) {
  shell.classList.toggle("excited", normalizedMode === "excited" || normalizedMode === "jumping");
  shell.classList.toggle("facing-left", isLeftFacing(mode));
}

function animationLoop(now) {
  const animation = ANIMS[currentMode] ?? ANIMS.idle;
  if (!lastFrameAt) {
    lastFrameAt = now;
  }

  accumulatedMs += now - lastFrameAt;
  lastFrameAt = now;

  const frameMs = 1000 / animation.fps;
  while (accumulatedMs >= frameMs) {
    accumulatedMs -= frameMs;
    frameIndex = (frameIndex + 1) % animation.frames;
  }

  setFrame(animation.row, frameIndex);
  animationFrameId = window.requestAnimationFrame(animationLoop);
}

function play(mode, options = {}) {
  const normalizedMode = normalizeMode(mode);
  currentMode = normalizedMode;
  frameIndex = 0;
  accumulatedMs = 0;
  lastFrameAt = 0;
  setModeClasses(mode, normalizedMode);
  setFrame(ANIMS[normalizedMode].row, frameIndex);

  if (animationFrameId) {
    window.cancelAnimationFrame(animationFrameId);
  }
  animationFrameId = window.requestAnimationFrame(animationLoop);

  if (options.forceBubble || Math.random() < 0.6) {
    showBubble(normalizedMode);
  }
}

function pick(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function showBubble(mode, message) {
  const messages = BUBBLES[mode] ?? BUBBLES.idle;
  bubble.textContent = message ?? pick(messages);
  bubble.hidden = false;
  window.clearTimeout(bubbleTimer);
  window.requestAnimationFrame(() => bubble.classList.add("visible"));
  bubbleTimer = window.setTimeout(() => {
    bubble.classList.remove("visible");
    bubbleTimer = window.setTimeout(() => {
      bubble.hidden = true;
    }, 220);
  }, 2800);
}

function showClickBubble() {
  const reactionMessages = ["Hi!", "\u266a~", "KYAAA~!", "h-huh...?"];
  showBubble(currentMode, pick(reactionMessages));
}

function showMenu() {
  menu.hidden = !menu.hidden;
}

function hideMenu() {
  menu.hidden = true;
}

function applySettings(settings) {
  currentSettings = {
    ...currentSettings,
    ...settings
  };
  screenAwarenessToggle.textContent = `Screen Awareness: ${currentSettings.screenAwareness ? "On" : "Off"}`;
  gameTipsToggle.textContent = `Game Tips: ${currentSettings.gameTips ? "On" : "Off"}`;
  gameTipsToggle.disabled = !currentSettings.screenAwareness;
}

window.mitaPet.onInit(({ manifest, mode, spritesheetUrl }) => {
  nameEl.textContent = manifest.displayName ?? "MitaPet";
  descriptionEl.textContent = manifest.description ?? "Desktop pet";
  sprite.style.backgroundImage = `url("${spritesheetUrl}")`;
  play(mode ?? "idle", { forceBubble: false });
  window.mitaPet.getState().then(({ settings }) => applySettings(settings));
});

window.mitaPet.onMode((mode) => play(mode));
window.mitaPet.onBubble(({ message, mode }) => showBubble(mode ?? currentMode, message));
window.mitaPet.onSettings((settings) => applySettings(settings));

hitbox.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) {
    return;
  }
  hitbox.setPointerCapture(event.pointerId);
  window.mitaPet.dragStart();
  drag = {
    startScreenX: event.screenX,
    startScreenY: event.screenY,
    startWindowX: window.screenX,
    startWindowY: window.screenY
  };
  shell.classList.add("dragging");
});

hitbox.addEventListener("pointermove", (event) => {
  if (!drag) {
    return;
  }
  const x = Math.round(drag.startWindowX + event.screenX - drag.startScreenX);
  const y = Math.round(drag.startWindowY + event.screenY - drag.startScreenY);
  window.moveTo(x, y);
});

hitbox.addEventListener("pointerup", (event) => {
  if (!drag) {
    return;
  }
  hitbox.releasePointerCapture(event.pointerId);
  shell.classList.remove("dragging");
  window.mitaPet.dragEnd({ x: window.screenX, y: window.screenY });
  clickSuppressUntil = Date.now() + 200;
  drag = null;
});

hitbox.addEventListener("click", () => {
  if (Date.now() < clickSuppressUntil) {
    return;
  }
  hideMenu();
  showClickBubble();
  window.mitaPet.clickReaction();
});

hitbox.addEventListener("dblclick", () => {
  showMenu();
});

hitbox.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  window.mitaPet.openContextMenu();
});

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.getAttribute("data-mode");
    window.mitaPet.setMode(mode);
    hideMenu();
  });
});

screenAwarenessToggle.addEventListener("click", () => {
  window.mitaPet.toggleScreenAwareness();
});

gameTipsToggle.addEventListener("click", () => {
  window.mitaPet.toggleGameTips();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hideMenu();
  }
});
