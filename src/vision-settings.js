const fields = [
  "visionEnabled",
  "autoVisionEnabled",
  "openaiApiKey",
  "openaiModel",
  "imageDetail",
  "maxImageWidth",
  "jpegQuality",
  "autoScanIntervalSeconds",
  "visionCooldownSeconds",
  "dailyRequestCap",
  "weeklyRequestCap"
];

const els = Object.fromEntries(fields.map((id) => [id, document.getElementById(id)]));
const maskedKey = document.getElementById("maskedKey");
const jpegQualityText = document.getElementById("jpegQualityText");
const dailyUsage = document.getElementById("dailyUsage");
const weeklyUsage = document.getElementById("weeklyUsage");
const title = document.getElementById("title");
const subtitle = document.getElementById("subtitle");

let lastPayload = null;
let isFirstRun = false;

function applyPayload(payload) {
  lastPayload = payload;
  isFirstRun = Boolean(payload.firstRun);
  const settings = payload.settings ?? {};

  title.textContent = isFirstRun ? "Enable OpenAI Vision Mode?" : "OpenAI Vision Mode";
  subtitle.textContent = isFirstRun ? "You can save an API key now or skip and enable it later." : "Optional, off by default, and controlled by you.";

  els.visionEnabled.checked = Boolean(settings.visionEnabled);
  els.autoVisionEnabled.checked = Boolean(settings.autoVisionEnabled);
  els.openaiApiKey.value = "";
  els.openaiModel.value = settings.openaiModel ?? "gpt-5.4-nano";
  els.imageDetail.value = settings.imageDetail ?? "low";
  els.maxImageWidth.value = settings.maxImageWidth ?? 1280;
  els.jpegQuality.value = settings.jpegQuality ?? 75;
  els.autoScanIntervalSeconds.value = settings.autoScanIntervalSeconds ?? 60;
  els.visionCooldownSeconds.value = settings.visionCooldownSeconds ?? 90;
  els.dailyRequestCap.value = settings.dailyRequestCap ?? 500;
  els.weeklyRequestCap.value = settings.weeklyRequestCap ?? 2500;

  maskedKey.textContent = settings.hasApiKey ? `Saved: ${settings.maskedApiKey}` : "No key saved";
  jpegQualityText.textContent = `${els.jpegQuality.value}%`;
  dailyUsage.textContent = settings.usage?.dailyCount ?? 0;
  weeklyUsage.textContent = settings.usage?.weeklyCount ?? 0;
}

function readSettings(enableOnSave = false) {
  return {
    visionEnabled: enableOnSave || els.visionEnabled.checked,
    autoVisionEnabled: els.autoVisionEnabled.checked,
    openaiApiKey: els.openaiApiKey.value,
    openaiModel: els.openaiModel.value,
    imageDetail: els.imageDetail.value,
    maxImageWidth: Number(els.maxImageWidth.value),
    jpegQuality: Number(els.jpegQuality.value),
    autoScanIntervalSeconds: Number(els.autoScanIntervalSeconds.value),
    visionCooldownSeconds: Number(els.visionCooldownSeconds.value),
    dailyRequestCap: Number(els.dailyRequestCap.value),
    weeklyRequestCap: Number(els.weeklyRequestCap.value),
    visionSetupSeen: true
  };
}

window.mitaVision.onSettings(applyPayload);

els.jpegQuality.addEventListener("input", () => {
  jpegQualityText.textContent = `${els.jpegQuality.value}%`;
});

document.getElementById("saveKey").addEventListener("click", () => {
  window.mitaVision.save(readSettings(false));
});

document.getElementById("saveAll").addEventListener("click", () => {
  window.mitaVision.save(readSettings(isFirstRun));
});

document.getElementById("skip").addEventListener("click", () => {
  window.mitaVision.skipFirstRun();
});

document.getElementById("clearKey").addEventListener("click", () => {
  els.openaiApiKey.value = "";
  window.mitaVision.clearApiKey();
});

document.getElementById("resetUsage").addEventListener("click", () => {
  window.mitaVision.resetUsage();
});
