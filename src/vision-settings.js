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
const autoIntervalStatus = document.getElementById("autoIntervalStatus");
const saveStatus = document.getElementById("saveStatus");
const saveAllButton = document.getElementById("saveAll");

let lastPayload = null;
let isFirstRun = false;

function updateTimingText(settings = lastPayload?.settings ?? {}) {
  const interval = Number(els.autoScanIntervalSeconds.value || settings.autoScanIntervalSeconds || 60);
  const cooldown = Number(els.visionCooldownSeconds.value || settings.visionCooldownSeconds || 90);
  const active = settings.autoVisionActive ? "Active" : "Saved";
  const cooldownNote = cooldown > interval ? ` Cooldown is ${cooldown}s, so some checks can be skipped.` : "";
  autoIntervalStatus.textContent = `${active}: screenshot attempt every ${interval}s.${cooldownNote}`;
}

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
  saveStatus.textContent = "";
  updateTimingText(settings);
}

function readSettings(enableOnSave = false, options = {}) {
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
    visionSetupSeen: true,
    closeAfterSave: Boolean(options.closeAfterSave)
  };
}

window.mitaVision.onSettings(applyPayload);

els.jpegQuality.addEventListener("input", () => {
  jpegQualityText.textContent = `${els.jpegQuality.value}%`;
});

els.autoScanIntervalSeconds.addEventListener("input", () => updateTimingText());
els.visionCooldownSeconds.addEventListener("input", () => updateTimingText());

document.getElementById("saveKey").addEventListener("click", () => {
  saveStatus.textContent = "Saving...";
  window.mitaVision.save(readSettings(false))
    .then(() => {
      saveStatus.textContent = "Saved.";
    })
    .catch(() => {
      saveStatus.textContent = "Save failed.";
    });
});

document.getElementById("saveAll").addEventListener("click", () => {
  saveAllButton.disabled = true;
  saveStatus.textContent = "Saving...";
  window.mitaVision.save(readSettings(true, { closeAfterSave: true }))
    .then(() => {
      saveStatus.textContent = "Saved.";
    })
    .catch(() => {
      saveAllButton.disabled = false;
      saveStatus.textContent = "Save failed.";
    });
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
