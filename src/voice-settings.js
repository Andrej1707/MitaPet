const fields = [
  "voiceModeEnabled",
  "pushToTalkKey",
  "voiceChatModel",
  "sttModel",
  "ttsEnabled",
  "ttsModel",
  "ttsVoice",
  "maxRecordingSeconds",
  "minRecordingMs",
  "voiceDailyRequestCap",
  "voiceWeeklyRequestCap",
  "voiceCooldownMs",
  "voiceLanguage",
  "voiceReplyMaxTokens"
];

const els = Object.fromEntries(fields.map((id) => [id, document.getElementById(id)]));
const dailyVoiceUsage = document.getElementById("dailyVoiceUsage");
const weeklyVoiceUsage = document.getElementById("weeklyVoiceUsage");
const apiKeyStatus = document.getElementById("apiKeyStatus");
const saveStatus = document.getElementById("saveStatus");

function applyPayload(payload) {
  const settings = payload?.settings ?? {};
  els.voiceModeEnabled.checked = Boolean(settings.voiceModeEnabled);
  els.pushToTalkKey.value = settings.pushToTalkKey ?? "F8";
  els.voiceChatModel.value = settings.voiceChatModel ?? "gpt-5.4-nano";
  els.sttModel.value = settings.sttModel ?? "gpt-4o-mini-transcribe";
  els.ttsEnabled.checked = Boolean(settings.ttsEnabled);
  els.ttsModel.value = settings.ttsModel ?? "gpt-4o-mini-tts";
  els.ttsVoice.value = settings.ttsVoice ?? "coral";
  els.maxRecordingSeconds.value = settings.maxRecordingSeconds ?? 20;
  els.minRecordingMs.value = settings.minRecordingMs ?? 500;
  els.voiceDailyRequestCap.value = settings.voiceDailyRequestCap ?? 100;
  els.voiceWeeklyRequestCap.value = settings.voiceWeeklyRequestCap ?? 500;
  els.voiceCooldownMs.value = settings.voiceCooldownMs ?? 1000;
  els.voiceLanguage.value = settings.voiceLanguage ?? "auto";
  els.voiceReplyMaxTokens.value = settings.voiceReplyMaxTokens ?? 120;
  dailyVoiceUsage.textContent = settings.voiceUsage?.dailyVoiceRequests ?? 0;
  weeklyVoiceUsage.textContent = settings.voiceUsage?.weeklyVoiceRequests ?? 0;
  apiKeyStatus.textContent = settings.hasApiKey ? "API key: saved" : "API key: not saved";
}

function readSettings() {
  return {
    voiceModeEnabled: els.voiceModeEnabled.checked,
    pushToTalkKey: els.pushToTalkKey.value,
    voiceChatModel: els.voiceChatModel.value,
    sttModel: els.sttModel.value,
    ttsEnabled: els.ttsEnabled.checked,
    ttsModel: els.ttsModel.value,
    ttsVoice: els.ttsVoice.value,
    maxRecordingSeconds: Number(els.maxRecordingSeconds.value),
    minRecordingMs: Number(els.minRecordingMs.value),
    voiceDailyRequestCap: Number(els.voiceDailyRequestCap.value),
    voiceWeeklyRequestCap: Number(els.voiceWeeklyRequestCap.value),
    voiceCooldownMs: Number(els.voiceCooldownMs.value),
    voiceLanguage: els.voiceLanguage.value,
    voiceReplyMaxTokens: Number(els.voiceReplyMaxTokens.value)
  };
}

window.mitaVoice.onSettings(applyPayload);

document.getElementById("saveAll").addEventListener("click", () => {
  saveStatus.textContent = "Saving...";
  window.mitaVoice.save(readSettings())
    .then((payload) => {
      applyPayload(payload);
      saveStatus.textContent = "Saved.";
    })
    .catch(() => {
      saveStatus.textContent = "Save failed.";
    });
});

document.getElementById("testMic").addEventListener("click", () => {
  window.mitaVoice.testMicrophone();
});

document.getElementById("testVoice").addEventListener("click", () => {
  window.mitaVoice.testVoice();
});

document.getElementById("resetUsage").addEventListener("click", () => {
  window.mitaVoice.resetUsage();
});
