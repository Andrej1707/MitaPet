# MitaDesktopPet

MitaDesktopPet is a standalone Windows desktop pet app. It uses Electron to show an animated transparent companion on the desktop.

![MitaDesktopPet on the desktop](docs/mita-desktop-preview.png)

## Download

Download the latest Windows installer from the GitHub release:

[MitaDesktopPet-2.0.9-Setup.exe](https://github.com/Andrej1707/MitaPet/releases/download/v2.0.9/MitaDesktopPet-2.0.9-Setup.exe)

## Features

- Transparent frameless always-on-top window
- Starts in the bottom-right corner
- Loads `assets/pet.json` and animates `assets/spritesheet.webp`
- Idle, walk, wave, excited, sad, pray, and shy modes
- Smooth requestAnimationFrame sprite animation
- Random wandering, hopping, emotes, and short click reactions
- Fading speech bubbles that size dynamically to the text
- Larger Vision bubbles with extra transparent window space so screenshot text has room
- Normal animation bubbles only appear at animation start and have a quiet pause before the next normal bubble
- Stronger cute, bubbly, tsundere Mita reactions with emoji-heavy Vision responses
- Mouse dragging with saved position
- Right-click menu with quit and Windows autostart toggle
- Double-click mini pet menu
- Optional tray icon
- Optional push-to-talk Voice Mode with separate Voice Settings
- Optional OpenAI TTS voice output, off by default
- Transparent empty areas around Mita pass clicks through to the desktop
- Windows installer prepared with electron-builder

## OpenAI Vision Mode

OpenAI Vision Mode is optional and disabled by default. MitaDesktopPet does not require OCR, local AI models, Python, Ollama, Gemma, PaddleOCR, or any model downloads.

You can provide your own OpenAI API key on first launch or later in Vision Settings. If no API key is saved, the pet still works normally without vision features.

Defaults:

- Model: `gpt-5.4-nano`
- Vision Mode: off
- Auto Vision: off
- Auto scan interval: `60` seconds
- Cooldown: `90` seconds
- Daily request cap: `500`
- Weekly request cap: `2500`
- Image detail: `low`
- Max image width: `1280`
- JPEG quality: `75`
- Capture mode: primary screen
- Mita hides herself before screenshots so she does not analyze her own overlay
- Speech bubbles are locked to one at a time, normal bubbles have a quiet pause, and Vision screenshot responses always have priority

Screenshots are only sent when Vision Mode is enabled and you use Manual Ask or enable Auto Vision. Screenshots are captured from the primary screen, downscaled to JPEG, and are not stored permanently by MitaDesktopPet.

Do not enable Auto Vision when private content is visible. You can use Manual Ask instead of Auto Vision.

Vision Settings lets you:

- Enable or disable OpenAI Vision Mode
- Save or clear your API key
- Change the model
- Change image detail, width, and JPEG quality
- Enable or disable Auto Vision
- Change scan interval and cooldown
- See the exact Auto Vision screenshot interval currently configured
- See Auto Vision status such as waiting, checking, retrying, cooldown, or request failed
- Give Mita short session memory from previous Vision observations since the app started
- Set daily and weekly request caps
- View and reset usage counters

## Voice Chat Mode

Voice Chat Mode is optional, push-to-talk only, and disabled by default. It uses the same locally saved OpenAI API key as Vision Mode, but its model settings are separate.

Defaults:

- Voice Mode: off
- Push-to-talk key: `F8`
- Voice chat model: `gpt-5.4-nano`
- Speech-to-text model: `gpt-4o-mini-transcribe`
- TTS: off
- TTS model: `gpt-4o-mini-tts`
- TTS voice: `coral`
- Max recording: `20` seconds
- Daily voice cap: `100`
- Weekly voice cap: `500`

Audio is sent to OpenAI only while you hold the push-to-talk key. There is no wake word, no continuous listening, and audio is not stored permanently by MitaDesktopPet. You can change the voice chat, STT, and TTS models in Voice Settings, or disable Voice Mode there at any time.

## Changelog

### v2.0.9

- Added optional push-to-talk Voice Mode with configurable OpenAI models.
- Added separate Voice Settings.
- Added optional TTS output.
- Fixed invisible click-blocking area around Mita.
- Improved click-through behavior for transparent overlay areas.

## Run Locally

```powershell
npm install
npm start
```

## Test

```powershell
npm test
npm audit --audit-level=high
```

## Build Windows Installer

```powershell
npm run dist
```

The installer is created at:

```text
dist/MitaDesktopPet-2.0.9-Setup.exe
```

## App Assets

- `assets/pet.json`
- `assets/spritesheet.webp`
