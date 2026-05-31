const FRAME_WIDTH = 192;
const FRAME_HEIGHT = 208;
const NORMAL_BUBBLE_PAUSE_MS = 5000;

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
const askVisionButton = document.getElementById("ask-vision");
const visionSettingsButton = document.getElementById("vision-settings");
const voiceSettingsButton = document.getElementById("voice-settings");

let animationFrameId = 0;
let lastFrameAt = 0;
let accumulatedMs = 0;
let frameIndex = 0;
let currentMode = "idle";
let drag = null;
let clickSuppressUntil = 0;
let bubbleTimer = 0;
let currentSettings = {
  visionEnabled: false,
  hasApiKey: false
};
let bubbleVisible = false;
let bubbleFadeTimer = 0;
let currentBubblePriority = false;
let nextNormalBubbleAllowedAt = 0;
let clickThroughActive = false;
let mediaRecorder = null;
let mediaStream = null;
let mediaChunks = [];
let recordingStartedAt = 0;
let recordingStopTimer = 0;

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

function notifyBubbleVisible(visible) {
  bubbleVisible = visible;
  window.mitaPet.setBubbleVisible(visible);
}

function clearBubble() {
  window.clearTimeout(bubbleTimer);
  window.clearTimeout(bubbleFadeTimer);
  bubble.classList.remove("visible");
  bubble.hidden = true;
  currentBubblePriority = false;
  notifyBubbleVisible(false);
}

function finishBubble(fadeMs = 500) {
  const wasPriority = currentBubblePriority;
  bubble.classList.remove("visible");
  bubbleFadeTimer = window.setTimeout(() => {
    bubble.hidden = true;
    currentBubblePriority = false;
    if (!wasPriority) {
      nextNormalBubbleAllowedAt = Date.now() + NORMAL_BUBBLE_PAUSE_MS;
    }
    notifyBubbleVisible(false);
  }, fadeMs);
}

function showBubble(mode, message, durationMs = 5000, options = {}) {
  const isPriority = options.priority === true || options.manual === true;
  if (!isPriority && Date.now() < nextNormalBubbleAllowedAt) {
    return;
  }
  if (bubbleVisible && !isPriority) {
    return;
  }
  if (bubbleVisible && isPriority) {
    clearBubble();
  }
  const messages = BUBBLES[mode] ?? BUBBLES.idle;
  bubble.textContent = message ?? pick(messages);
  bubble.hidden = false;
  window.clearTimeout(bubbleTimer);
  window.clearTimeout(bubbleFadeTimer);
  currentBubblePriority = isPriority;
  notifyBubbleVisible(true);
  window.requestAnimationFrame(() => bubble.classList.add("visible"));
  bubbleTimer = window.setTimeout(() => {
    finishBubble(500);
  }, durationMs);
}

function showClickBubble() {
  const reactionMessages = ["Hi!", "\u266a~", "KYAAA~!", "h-huh...?"];
  showBubble(currentMode, pick(reactionMessages), 5000);
}

function showMenu() {
  menu.hidden = !menu.hidden;
  updateClickThrough();
}

function hideMenu() {
  menu.hidden = true;
  updateClickThrough();
}

function applySettings(settings) {
  currentSettings = {
    ...currentSettings,
    ...settings
  };
  askVisionButton.disabled = false;
}

function pointInRect(x, y, rect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function setClickThrough(enabled) {
  if (clickThroughActive === enabled) {
    return;
  }
  clickThroughActive = enabled;
  window.mitaPet.setClickThrough(enabled);
}

function updateClickThrough(event) {
  if (drag) {
    setClickThrough(false);
    return;
  }
  if (!event) {
    setClickThrough(menu.hidden);
    return;
  }
  const x = event.clientX;
  const y = event.clientY;
  const overPet = pointInRect(x, y, hitbox.getBoundingClientRect());
  const overMenu = !menu.hidden && pointInRect(x, y, menu.getBoundingClientRect());
  setClickThrough(!(overPet || overMenu));
}

function stopMediaStream() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  window.clearTimeout(recordingStopTimer);
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
}

async function startRecording({ maxRecordingSeconds } = {}) {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    return;
  }
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaChunks = [];
    const options = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? { mimeType: "audio/webm;codecs=opus" }
      : {};
    mediaRecorder = new MediaRecorder(mediaStream, options);
    recordingStartedAt = Date.now();
    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data?.size) {
        mediaChunks.push(event.data);
      }
    });
    mediaRecorder.addEventListener("stop", async () => {
      const mimeType = mediaRecorder.mimeType || "audio/webm";
      const durationMs = Date.now() - recordingStartedAt;
      const blob = new Blob(mediaChunks, { type: mimeType });
      const buffer = await blob.arrayBuffer();
      stopMediaStream();
      window.mitaVoice.recordingComplete({
        bytes: Array.from(new Uint8Array(buffer)),
        durationMs,
        mimeType
      });
      mediaRecorder = null;
      mediaChunks = [];
    });
    mediaRecorder.start();
    recordingStopTimer = window.setTimeout(stopRecording, Math.max(2, Number(maxRecordingSeconds || 20)) * 1000);
  } catch {
    stopMediaStream();
    mediaRecorder = null;
    window.mitaVoice.recordingError("Microphone could not start.");
  }
}

function playVoiceAudio({ base64, mimeType }) {
  if (!base64) {
    window.mitaVoice.playbackEnded();
    return;
  }
  const audio = new Audio(`data:${mimeType || "audio/mpeg"};base64,${base64}`);
  audio.addEventListener("ended", () => window.mitaVoice.playbackEnded(), { once: true });
  audio.addEventListener("error", () => window.mitaVoice.playbackEnded(), { once: true });
  audio.play().catch(() => window.mitaVoice.playbackEnded());
}

window.mitaPet.onInit(({ manifest, mode, spritesheetUrl }) => {
  nameEl.textContent = manifest.displayName ?? "MitaPet";
  descriptionEl.textContent = manifest.description ?? "Desktop pet";
  sprite.style.backgroundImage = `url("${spritesheetUrl}")`;
  play(mode ?? "idle", { forceBubble: false });
  window.mitaPet.getState().then(({ settings }) => applySettings(settings));
  updateClickThrough();
});

window.mitaPet.onMode((mode) => play(mode));
window.mitaPet.onBubble(({ message, mode, durationMs, manual, priority }) => showBubble(mode ?? currentMode, message, durationMs, { manual, priority }));
window.mitaPet.onClearBubble(() => clearBubble());
window.mitaPet.onSettings((settings) => applySettings(settings));

hitbox.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) {
    return;
  }
  setClickThrough(false);
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
  updateClickThrough(event);
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

askVisionButton.addEventListener("click", () => {
  window.mitaPet.askVision();
});

visionSettingsButton.addEventListener("click", () => {
  window.mitaPet.openVisionSettings();
});

voiceSettingsButton.addEventListener("click", () => {
  window.mitaPet.openVoiceSettings();
});

window.mitaVoice.onStartRecording(startRecording);
window.mitaVoice.onStopRecording(stopRecording);
window.mitaVoice.onPlayAudio(playVoiceAudio);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hideMenu();
  }
});

document.addEventListener("mousemove", updateClickThrough);
document.addEventListener("mouseleave", () => setClickThrough(true));
document.addEventListener("mouseenter", updateClickThrough);
