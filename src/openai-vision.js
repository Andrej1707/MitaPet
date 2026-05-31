const { desktopCapturer, screen } = require("electron");
const { execFile } = require("child_process");
const https = require("https");
const {
  buildVisionPrompt,
  detectMode,
  parseVisionResult
} = require("./vision-core");

function runPowerShell(script) {
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true, timeout: 2500 },
      (_error, stdout) => resolve(stdout.trim())
    );
  });
}

async function getActiveWindowMetadata() {
  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinApi {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
"@
$hwnd = [WinApi]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 512
[void][WinApi]::GetWindowText($hwnd, $sb, $sb.Capacity)
$pidNum = 0
[void][WinApi]::GetWindowThreadProcessId($hwnd, [ref]$pidNum)
$rect = New-Object WinApi+RECT
[void][WinApi]::GetWindowRect($hwnd, [ref]$rect)
$proc = $null
try { $proc = Get-Process -Id $pidNum -ErrorAction Stop } catch {}
[pscustomobject]@{
  hwnd = $hwnd.ToInt64()
  processId = $pidNum
  processName = if ($proc) { $proc.ProcessName } else { "" }
  processPath = if ($proc) { $proc.Path } else { "" }
  windowTitle = $sb.ToString()
  bounds = @{
    x = $rect.Left
    y = $rect.Top
    width = [Math]::Max(0, $rect.Right - $rect.Left)
    height = [Math]::Max(0, $rect.Bottom - $rect.Top)
  }
} | ConvertTo-Json -Compress -Depth 4`;
  try {
    const parsed = JSON.parse(await runPowerShell(script));
    const display = screen.getDisplayMatching(parsed.bounds || { x: 0, y: 0, width: 1, height: 1 });
    const workArea = display?.workArea ?? display?.bounds;
    const isFullscreen = Boolean(
      parsed.bounds &&
      workArea &&
      parsed.bounds.width >= workArea.width - 8 &&
      parsed.bounds.height >= workArea.height - 8
    );
    return {
      ...parsed,
      detectedMode: detectMode(parsed),
      isFullscreen,
      timestamp: new Date().toISOString()
    };
  } catch {
    return {
      processName: "",
      processPath: "",
      windowTitle: "",
      detectedMode: "unknown",
      isFullscreen: false,
      timestamp: new Date().toISOString()
    };
  }
}

async function captureForVision(metadata, settings) {
  const maxWidth = Number(settings.maxImageWidth || 1280);
  const thumbnailSize = { width: maxWidth, height: Math.round(maxWidth * 0.625) };
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize,
    fetchWindowIcons: false
  });

  const primaryDisplayId = String(screen.getPrimaryDisplay().id);
  const primaryScreen = sources.find((source) => source.display_id === primaryDisplayId && !source.thumbnail.isEmpty())
    ?? sources.find((source) => source.id.startsWith("screen:") && !source.thumbnail.isEmpty());
  const fallback = sources.find((source) => !source.thumbnail.isEmpty());
  const source = primaryScreen ?? fallback;

  if (!source || source.thumbnail.isEmpty()) {
    return null;
  }

  let image = source.thumbnail;
  const size = image.getSize();
  if (size.width > maxWidth) {
    image = image.resize({
      width: maxWidth,
      height: Math.round(size.height * (maxWidth / size.width))
    });
  }

  return {
    sourceName: source.name,
    base64Image: image.toJPEG(Number(settings.jpegQuality || 75)).toString("base64")
  };
}

function postJson(url, apiKey, payload) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(payload));
    const request = https.request(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Content-Length": body.length,
        "User-Agent": "MitaDesktopPet/2.0"
      }
    }, (response) => {
      let data = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        data += chunk;
      });
      response.on("end", () => {
        let parsed = {};
        try {
          parsed = data ? JSON.parse(data) : {};
        } catch {
          parsed = { raw: data };
        }
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(parsed);
        } else {
          const error = new Error(parsed?.error?.message || `OpenAI request failed (${response.statusCode})`);
          error.statusCode = response.statusCode;
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

function extractOutputText(response) {
  if (response.output_text) {
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

async function askOpenAIVision({ apiKey, settings }) {
  const metadata = await getActiveWindowMetadata();
  let capture = null;
  if (typeof settings.beforeCapture === "function") {
    await settings.beforeCapture();
  }
  try {
    capture = await captureForVision(metadata, settings);
  } finally {
    if (typeof settings.afterCapture === "function") {
      await settings.afterCapture();
    }
  }
  if (!capture) {
    const error = new Error("capture-failed");
    error.code = "capture-failed";
    throw error;
  }

  const prompt = buildVisionPrompt(metadata, settings.visionMemory);
  const response = await postJson("https://api.openai.com/v1/responses", apiKey, {
    model: settings.openaiModel || "gpt-5.4-nano",
    input: [{
      role: "user",
      content: [
        {
          type: "input_text",
          text: prompt
        },
        {
          type: "input_image",
          image_url: `data:image/jpeg;base64,${capture.base64Image}`,
          detail: settings.imageDetail || "low"
        }
      ]
    }],
    text: {
      format: {
        type: "json_schema",
        name: "mita_vision_result",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            mode: {
              type: "string",
              enum: ["game", "coding", "terminal", "browser", "video", "desktop", "unknown"]
            },
            confidence: {
              type: "number"
            },
            seen: {
              type: "string"
            },
            important_details: {
              type: "array",
              items: { type: "string" }
            },
            tip: {
              type: "string"
            },
            should_speak: {
              type: "boolean"
            }
          },
          required: ["mode", "confidence", "seen", "important_details", "tip", "should_speak"]
        }
      }
    }
  });

  return {
    metadata,
    result: parseVisionResult(extractOutputText(response))
  };
}

module.exports = {
  askOpenAIVision,
  captureForVision,
  getActiveWindowMetadata
};
