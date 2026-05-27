const COLS = 8;
const ROWS = 9;

const ANIMATIONS = {
  idle: {
    frames: [
      [0, 0, 280],
      [0, 1, 110],
      [0, 2, 110],
      [0, 3, 140],
      [0, 4, 140],
      [0, 5, 320]
    ],
    loop: true
  },
  "walk-right": { frames: makeRow(1, 8, 120), loop: true },
  "walk-left": { frames: makeRow(2, 8, 120), loop: true },
  walk: { frames: makeRow(1, 8, 120), loop: true },
  jumping: { frames: makeRow(4, 5, 140), loop: false, fallback: "idle" },
  sleep: {
    frames: [
      [0, 3, 900],
      [0, 4, 900]
    ],
    loop: true
  },
  excited: { frames: makeRow(3, 4, 110), loop: true },
  failed: { frames: makeRow(5, 8, 150), loop: true },
  waiting: { frames: makeRow(6, 6, 150), loop: true },
  running: { frames: makeRow(7, 6, 120), loop: true },
  review: { frames: makeRow(8, 6, 150), loop: true }
};

const shell = document.getElementById("pet-shell");
const hitbox = document.getElementById("pet-hitbox");
const sprite = document.getElementById("pet-sprite");
const menu = document.getElementById("pet-menu");
const nameEl = document.getElementById("pet-name");
const descriptionEl = document.getElementById("pet-description");

let animationTimer = null;
let currentMode = "idle";
let drag = null;
let clickSuppressUntil = 0;

function makeRow(row, count, duration) {
  return Array.from({ length: count }, (_, column) => [row, column, duration]);
}

function setFrame(row, column) {
  const x = (column / (COLS - 1)) * 100;
  const y = (row / (ROWS - 1)) * 100;
  sprite.style.backgroundPosition = `${x}% ${y}%`;
}

function play(mode) {
  clearTimeout(animationTimer);
  currentMode = mode;
  shell.classList.toggle("sleep", mode === "sleep");
  shell.classList.toggle("excited", mode === "excited");

  const animation = ANIMATIONS[mode] ?? ANIMATIONS.idle;
  let index = 0;

  const step = () => {
    const [row, column, duration] = animation.frames[index];
    setFrame(row, column);
    index += 1;

    if (index >= animation.frames.length) {
      if (animation.loop) {
        index = 0;
      } else {
        play(animation.fallback ?? "idle");
        return;
      }
    }
    animationTimer = window.setTimeout(step, duration);
  };

  step();
}

function showMenu() {
  menu.hidden = !menu.hidden;
}

function hideMenu() {
  menu.hidden = true;
}

window.mitaPet.onInit(({ manifest, mode, spritesheetUrl }) => {
  nameEl.textContent = manifest.displayName ?? "MitaPet";
  descriptionEl.textContent = manifest.description ?? "Desktop pet";
  sprite.style.backgroundImage = `url("${spritesheetUrl}")`;
  play(mode ?? "idle");
});

window.mitaPet.onMode((mode) => play(mode));

hitbox.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) {
    return;
  }
  hitbox.setPointerCapture(event.pointerId);
  window.mitaPet.dragStart();
  const bounds = window.screen;
  drag = {
    startScreenX: event.screenX,
    startScreenY: event.screenY,
    startWindowX: window.screenX,
    startWindowY: window.screenY,
    screenLeft: bounds.availLeft ?? 0,
    screenTop: bounds.availTop ?? 0
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

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hideMenu();
  }
});
