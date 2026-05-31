const DEFAULT_VOICE_SETTINGS = {
  voiceModeEnabled: false,
  pushToTalkKey: "F8",
  voiceChatModel: "gpt-5.4-nano",
  sttModel: "gpt-4o-mini-transcribe",
  ttsEnabled: false,
  ttsModel: "gpt-4o-mini-tts",
  ttsVoice: "coral",
  maxRecordingSeconds: 20,
  minRecordingMs: 500,
  voiceDailyRequestCap: 100,
  voiceWeeklyRequestCap: 500,
  voiceCooldownMs: 1000,
  voiceLanguage: "auto",
  voiceReplyMaxTokens: 120,
  voiceUsage: {
    dailyVoiceRequests: 0,
    weeklyVoiceRequests: 0,
    lastVoiceRequestTimestamp: 0,
    lastVoiceDailyReset: "",
    lastVoiceWeeklyReset: ""
  }
};

const VOICE_EMOTIONS = ["idle", "happy", "shy", "excited", "sleep", "sad", "pray"];
const DEFAULT_VOICE_FALLBACK = "H-Ha?! Ich hab kurz den Faden verloren... nicht, dass mich das nervoes macht oder so 😤💕";

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(Math.round(parsed), min), max);
}

function getLocalDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function getLocalWeekKey(now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function normalizeVoiceSettings(input = {}) {
  const merged = {
    ...DEFAULT_VOICE_SETTINGS,
    ...input,
    voiceUsage: {
      ...DEFAULT_VOICE_SETTINGS.voiceUsage,
      ...(input.voiceUsage ?? {})
    }
  };

  merged.voiceModeEnabled = Boolean(merged.voiceModeEnabled);
  merged.pushToTalkKey = String(merged.pushToTalkKey || "F8").trim() || "F8";
  merged.voiceChatModel = String(merged.voiceChatModel || DEFAULT_VOICE_SETTINGS.voiceChatModel).trim() || DEFAULT_VOICE_SETTINGS.voiceChatModel;
  merged.sttModel = String(merged.sttModel || DEFAULT_VOICE_SETTINGS.sttModel).trim() || DEFAULT_VOICE_SETTINGS.sttModel;
  merged.ttsEnabled = Boolean(merged.ttsEnabled);
  merged.ttsModel = String(merged.ttsModel || DEFAULT_VOICE_SETTINGS.ttsModel).trim() || DEFAULT_VOICE_SETTINGS.ttsModel;
  merged.ttsVoice = String(merged.ttsVoice || DEFAULT_VOICE_SETTINGS.ttsVoice).trim() || DEFAULT_VOICE_SETTINGS.ttsVoice;
  merged.maxRecordingSeconds = clampNumber(merged.maxRecordingSeconds, 20, 2, 120);
  merged.minRecordingMs = clampNumber(merged.minRecordingMs, 500, 100, 10000);
  merged.voiceDailyRequestCap = clampNumber(merged.voiceDailyRequestCap, 100, 1, 10000);
  merged.voiceWeeklyRequestCap = clampNumber(merged.voiceWeeklyRequestCap, 500, 1, 50000);
  merged.voiceCooldownMs = clampNumber(merged.voiceCooldownMs, 1000, 0, 60000);
  merged.voiceLanguage = String(merged.voiceLanguage || "auto").trim() || "auto";
  merged.voiceReplyMaxTokens = clampNumber(merged.voiceReplyMaxTokens, 120, 20, 500);
  return merged;
}

function resetVoiceUsageIfNeeded(settings, now = new Date()) {
  const next = normalizeVoiceSettings(settings);
  const dayKey = getLocalDateKey(now);
  const weekKey = getLocalWeekKey(now);

  if (next.voiceUsage.lastVoiceDailyReset !== dayKey) {
    next.voiceUsage.dailyVoiceRequests = 0;
    next.voiceUsage.lastVoiceDailyReset = dayKey;
  }
  if (next.voiceUsage.lastVoiceWeeklyReset !== weekKey) {
    next.voiceUsage.weeklyVoiceRequests = 0;
    next.voiceUsage.lastVoiceWeeklyReset = weekKey;
  }
  return next;
}

function canMakeVoiceRequest(settings, hasApiKey, nowMs = Date.now()) {
  const normalized = resetVoiceUsageIfNeeded(settings);
  if (!normalized.voiceModeEnabled) {
    return { ok: false, reason: "voice-disabled", settings: normalized };
  }
  if (!hasApiKey) {
    return { ok: false, reason: "missing-api-key", settings: normalized };
  }
  if (normalized.voiceUsage.dailyVoiceRequests >= normalized.voiceDailyRequestCap) {
    return { ok: false, reason: "daily-cap", settings: normalized };
  }
  if (normalized.voiceUsage.weeklyVoiceRequests >= normalized.voiceWeeklyRequestCap) {
    return { ok: false, reason: "weekly-cap", settings: normalized };
  }
  if (nowMs - Number(normalized.voiceUsage.lastVoiceRequestTimestamp || 0) < normalized.voiceCooldownMs) {
    return { ok: false, reason: "cooldown", settings: normalized };
  }
  return { ok: true, reason: "ok", settings: normalized };
}

function recordVoiceRequest(settings, now = new Date()) {
  const next = resetVoiceUsageIfNeeded(settings, now);
  next.voiceUsage.dailyVoiceRequests += 1;
  next.voiceUsage.weeklyVoiceRequests += 1;
  next.voiceUsage.lastVoiceRequestTimestamp = now.getTime();
  return next;
}

function resetVoiceUsageCounters(settings) {
  const next = normalizeVoiceSettings(settings);
  next.voiceUsage = {
    ...DEFAULT_VOICE_SETTINGS.voiceUsage,
    lastVoiceDailyReset: getLocalDateKey(),
    lastVoiceWeeklyReset: getLocalWeekKey()
  };
  return next;
}

function parseVoiceReply(outputText) {
  const raw = String(outputText || "").trim();
  if (!raw) {
    return {
      reply: DEFAULT_VOICE_FALLBACK,
      emotion: "shy",
      should_speak: true
    };
  }

  try {
    return normalizeVoiceReply(JSON.parse(raw));
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return normalizeVoiceReply(JSON.parse(match[0]));
      } catch {
        // Fall through to plain text.
      }
    }
  }

  return {
    reply: withVoiceStyle(raw),
    emotion: "idle",
    should_speak: true
  };
}

function normalizeVoiceReply(value) {
  return {
    reply: withVoiceStyle(value.reply || DEFAULT_VOICE_FALLBACK),
    emotion: VOICE_EMOTIONS.includes(value.emotion) ? value.emotion : "idle",
    should_speak: value.should_speak !== false
  };
}

function hasExpressiveMarker(text) {
  return /[\u{1F300}-\u{1FAFF}\u2728\u266a~]|Baka|Tsk|H-Ha|Nyaa|😤|💕|💢|😭|😳/u.test(String(text || ""));
}

function withVoiceStyle(text) {
  const value = String(text || "").trim();
  if (!value) {
    return DEFAULT_VOICE_FALLBACK;
  }
  if (hasExpressiveMarker(value)) {
    return value.slice(0, 320);
  }
  const prefix = "Tsk... ";
  const suffix = " Baka 😤💕";
  const available = 320 - prefix.length - suffix.length;
  return `${prefix}${value.slice(0, Math.max(0, available)).trimEnd()}${suffix}`;
}

module.exports = {
  DEFAULT_VOICE_SETTINGS,
  canMakeVoiceRequest,
  normalizeVoiceSettings,
  parseVoiceReply,
  recordVoiceRequest,
  resetVoiceUsageCounters,
  resetVoiceUsageIfNeeded
};
