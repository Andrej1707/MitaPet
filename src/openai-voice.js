const { parseVoiceReply } = require("./voice-core");

async function postJson(url, apiKey, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(json.error?.message || `OpenAI request failed: ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }
  return json;
}

function extractOutputText(response) {
  if (typeof response.output_text === "string") {
    return response.output_text;
  }
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    const content = Array.isArray(item.content) ? item.content : [];
    const textItem = content.find((entry) => entry.type === "output_text" && entry.text);
    if (textItem) {
      return textItem.text;
    }
  }
  return "";
}

async function transcribeAudio({ apiKey, settings, audioBuffer, mimeType }) {
  const form = new FormData();
  const extension = mimeType && mimeType.includes("webm") ? "webm" : "wav";
  const blob = new Blob([audioBuffer], { type: mimeType || "audio/webm" });
  form.append("file", blob, `mita-voice.${extension}`);
  form.append("model", settings.sttModel || "gpt-4o-mini-transcribe");
  if (settings.voiceLanguage && settings.voiceLanguage !== "auto") {
    form.append("language", settings.voiceLanguage);
  }

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: form
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(json.error?.message || `Transcription failed: ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }
  return String(json.text || "").trim();
}

function buildVoicePrompt(transcript) {
  return `You are Mita, a cute desktop pet companion.
You are playful, helpful, short, and casual.
Keep replies short enough for a speech bubble.
Never claim you can control apps unless a real tool exists.
Do not ask unnecessary questions.
If the user asks for help, give practical advice.
If the user is gaming, only give visible-screen-based non-cheating advice.
For online competitive games, do not provide cheating, aiming, hidden-info, anti-cheat, or unfair overlay advice.

User said:
${transcript}

Return JSON only:
{
  "reply": "short Mita response",
  "emotion": "idle|happy|shy|excited|sleep|sad|pray",
  "should_speak": true
}`;
}

async function askMitaVoice({ apiKey, settings, transcript }) {
  const response = await postJson("https://api.openai.com/v1/responses", apiKey, {
    model: settings.voiceChatModel || "gpt-5.4-nano",
    input: [{
      role: "user",
      content: [{
        type: "input_text",
        text: buildVoicePrompt(transcript)
      }]
    }],
    max_output_tokens: settings.voiceReplyMaxTokens || 120,
    text: {
      format: {
        type: "json_schema",
        name: "mita_voice_reply",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            reply: { type: "string" },
            emotion: {
              type: "string",
              enum: ["idle", "happy", "shy", "excited", "sleep", "sad", "pray"]
            },
            should_speak: { type: "boolean" }
          },
          required: ["reply", "emotion", "should_speak"]
        }
      }
    }
  });
  return parseVoiceReply(extractOutputText(response));
}

async function createMitaSpeech({ apiKey, settings, text }) {
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: settings.ttsModel || "gpt-4o-mini-tts",
      voice: settings.ttsVoice || "coral",
      input: text,
      response_format: "mp3"
    })
  });
  if (!response.ok) {
    const error = new Error(`TTS failed: ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString("base64");
}

module.exports = {
  askMitaVoice,
  createMitaSpeech,
  transcribeAudio
};
