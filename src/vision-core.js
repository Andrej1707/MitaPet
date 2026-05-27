const DEFAULT_OPENAI_MODEL = "gpt-5.4-nano";

const DEFAULT_VISION_SETTINGS = {
  openaiModel: DEFAULT_OPENAI_MODEL,
  visionEnabled: false,
  autoVisionEnabled: false,
  autoScanIntervalSeconds: 60,
  visionCooldownSeconds: 90,
  dailyRequestCap: 500,
  weeklyRequestCap: 2500,
  maxImageWidth: 1280,
  jpegQuality: 75,
  imageDetail: "low",
  visionSetupSeen: false,
  usage: {
    dailyCount: 0,
    weeklyCount: 0,
    lastRequestAt: 0,
    lastDailyReset: "",
    lastWeeklyReset: ""
  }
};

const MODE_RULES = [
  {
    mode: "game",
    process: ["robloxplayerbeta", "minecraft", "unityplayer", "unreal", "steam", "epicgameslauncher", "valorant", "fortnite", "cs2", "leagueclient", "overwatch", "r5apex"]
  },
  {
    mode: "coding",
    process: ["code", "cursor", "devenv", "idea64", "webstorm64", "pycharm64", "rider64", "phpstorm64", "clion64", "windsurf"]
  },
  {
    mode: "terminal",
    process: ["powershell", "pwsh", "cmd", "windowsterminal", "wt", "conhost"]
  },
  {
    mode: "browser",
    process: ["chrome", "msedge", "firefox", "opera", "brave", "vivaldi"]
  },
  {
    mode: "desktop",
    process: ["explorer", "shellexperiencehost", "searchhost"]
  }
];

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(Math.round(parsed), min), max);
}

function normalizeVisionSettings(input = {}) {
  const merged = {
    ...DEFAULT_VISION_SETTINGS,
    ...input,
    usage: {
      ...DEFAULT_VISION_SETTINGS.usage,
      ...(input.usage ?? {})
    }
  };

  merged.openaiModel = String(merged.openaiModel || DEFAULT_OPENAI_MODEL).trim() || DEFAULT_OPENAI_MODEL;
  merged.visionEnabled = Boolean(merged.visionEnabled);
  merged.autoVisionEnabled = Boolean(merged.autoVisionEnabled);
  merged.autoScanIntervalSeconds = clampNumber(merged.autoScanIntervalSeconds, 60, 15, 3600);
  merged.visionCooldownSeconds = clampNumber(merged.visionCooldownSeconds, 90, 5, 3600);
  merged.dailyRequestCap = clampNumber(merged.dailyRequestCap, 500, 1, 10000);
  merged.weeklyRequestCap = clampNumber(merged.weeklyRequestCap, 2500, 1, 50000);
  merged.maxImageWidth = clampNumber(merged.maxImageWidth, 1280, 320, 1600);
  merged.jpegQuality = clampNumber(merged.jpegQuality, 75, 35, 95);
  merged.imageDetail = ["low", "high", "auto"].includes(merged.imageDetail) ? merged.imageDetail : "low";

  return merged;
}

function maskApiKey(apiKey) {
  if (!apiKey) {
    return "";
  }
  const value = String(apiKey).trim();
  if (value.length <= 8) {
    return "sk-...";
  }
  return `${value.slice(0, 3)}...${value.slice(-4)}`;
}

function detectMode(metadata = {}) {
  const processName = String(metadata.processName || "").toLowerCase().replace(/\.exe$/, "");
  const title = String(metadata.windowTitle || "").toLowerCase();

  if (["youtube", "netflix", "twitch", "video"].some((word) => title.includes(word))) {
    return "video";
  }

  for (const rule of MODE_RULES) {
    if (rule.process.some((name) => processName.includes(name))) {
      if (rule.mode === "browser" && ["youtube", "netflix", "twitch"].some((word) => title.includes(word))) {
        return "video";
      }
      return rule.mode;
    }
  }

  return "unknown";
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

function resetUsageIfNeeded(settings, now = new Date()) {
  const next = normalizeVisionSettings(settings);
  const dayKey = getLocalDateKey(now);
  const weekKey = getLocalWeekKey(now);

  if (next.usage.lastDailyReset !== dayKey) {
    next.usage.dailyCount = 0;
    next.usage.lastDailyReset = dayKey;
  }
  if (next.usage.lastWeeklyReset !== weekKey) {
    next.usage.weeklyCount = 0;
    next.usage.lastWeeklyReset = weekKey;
  }
  return next;
}

function canMakeVisionRequest(settings, hasApiKey, manual = false, nowMs = Date.now()) {
  const normalized = resetUsageIfNeeded(settings);
  if (!normalized.visionEnabled && !manual) {
    return { ok: false, reason: "vision-disabled", settings: normalized };
  }
  if (!hasApiKey) {
    return { ok: false, reason: "missing-api-key", settings: normalized };
  }
  if (normalized.usage.dailyCount >= normalized.dailyRequestCap) {
    return { ok: false, reason: "daily-cap", settings: normalized };
  }
  if (normalized.usage.weeklyCount >= normalized.weeklyRequestCap) {
    return { ok: false, reason: "weekly-cap", settings: normalized };
  }
  const cooldownMs = (manual ? Math.min(normalized.visionCooldownSeconds, 8) : normalized.visionCooldownSeconds) * 1000;
  if (nowMs - Number(normalized.usage.lastRequestAt || 0) < cooldownMs) {
    return { ok: false, reason: "cooldown", settings: normalized };
  }
  return { ok: true, reason: "ok", settings: normalized };
}

function recordVisionRequest(settings, now = new Date()) {
  const next = resetUsageIfNeeded(settings, now);
  next.usage.dailyCount += 1;
  next.usage.weeklyCount += 1;
  next.usage.lastRequestAt = now.getTime();
  return next;
}

function resetUsageCounters(settings) {
  const next = normalizeVisionSettings(settings);
  next.usage = {
    ...DEFAULT_VISION_SETTINGS.usage,
    lastDailyReset: getLocalDateKey(),
    lastWeeklyReset: getLocalWeekKey()
  };
  return next;
}

function parseVisionResult(outputText) {
  const raw = String(outputText || "").trim();
  if (!raw) {
    return {
      mode: "unknown",
      confidence: 0,
      seen: "",
      important_details: [],
      tip: "Vision answer was empty.",
      should_speak: true
    };
  }

  try {
    return normalizeVisionResult(JSON.parse(raw));
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return normalizeVisionResult(JSON.parse(match[0]));
      } catch {
        // Fall through to plain text fallback.
      }
    }
  }

  return {
    mode: "unknown",
    confidence: 0.2,
    seen: raw.slice(0, 160),
    important_details: [],
    tip: raw.slice(0, 90) || "I saw something, but it was unclear.",
    should_speak: true
  };
}

function normalizeVisionResult(value) {
  const allowedModes = ["game", "coding", "terminal", "browser", "video", "desktop", "unknown"];
  return {
    mode: allowedModes.includes(value.mode) ? value.mode : "unknown",
    confidence: Math.min(Math.max(Number(value.confidence) || 0, 0), 1),
    seen: String(value.seen || "").slice(0, 320),
    important_details: Array.isArray(value.important_details)
      ? value.important_details.map((item) => String(item).slice(0, 180)).slice(0, 6)
      : [],
    tip: String(value.tip || "").slice(0, 180),
    should_speak: Boolean(value.should_speak)
  };
}

function buildVisionPrompt(metadata) {
  return `You are Mita, a cute but useful desktop pet assistant.

You receive:
1. a screenshot from the user's current active window or screen
2. Windows metadata about the active app

Metadata:
- active process: ${metadata.processName || "unknown"}
- active window title: ${metadata.windowTitle || "unknown"}
- detected mode: ${metadata.detectedMode || "unknown"}
- fullscreen: ${metadata.isFullscreen ? "yes" : "no"}

Your task:
Analyze the screenshot and return JSON only.

Rules:
- Prefer accuracy over jokes.
- Extract visible details from the image.
- Do not give generic responses like "Roblox is running" or "PowerShell is open".
- If details are unclear, say that clearly.
- Do not invent hidden information.
- Only use visible screen information and provided metadata.
- Do not claim Mita can click, open, close, or control apps.
- Do not ask questions.
- Keep the tip short and suitable for a speech bubble.
- The tip should sound like Mita: cute, casual, lightly playful, but useful.

Mode-specific behavior:

desktop:
- Make a cute short observation or mention visible desktop/app state.

browser:
- Mention visible page/app/content only if clear.
- If the page looks private or unclear, stay vague.

video:
- Be low-noise.
- Do not interrupt much.
- Only comment if visible content/player is clear.

coding:
- Mention visible errors, files, logs, package installs, builds, tests, GitHub, terminal output, or code context if visible.

terminal:
- Mention visible commands, errors, model tests, installs, logs, or output if visible.
- If details are unclear, say terminal details are unclear.

game:
- Give one useful visible-screen-based tip or observation.
- Mention visible HUD, menus, health, objectives, character state, terrain, enemies, buttons, prompts, or danger if clear.
- For online competitive games: no cheating, no aim advice, no hidden-info analysis, no enemy tracking beyond visible screen, no overlay advantage, no anti-cheat bypass.
- Only use visible screen information.

Return JSON only:

{
  "mode": "game|coding|terminal|browser|video|desktop|unknown",
  "confidence": 0.0,
  "seen": "short description of visible screen",
  "important_details": ["detail1", "detail2", "detail3"],
  "tip": "one short Mita reaction or tip",
  "should_speak": true
}

If nothing useful should be said:
- set should_speak to false
- tip should be empty string`;
}

module.exports = {
  DEFAULT_OPENAI_MODEL,
  DEFAULT_VISION_SETTINGS,
  buildVisionPrompt,
  canMakeVisionRequest,
  detectMode,
  maskApiKey,
  normalizeVisionSettings,
  parseVisionResult,
  recordVisionRequest,
  resetUsageCounters,
  resetUsageIfNeeded
};
