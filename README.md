# MitaDesktopPet

MitaDesktopPet is a standalone Windows desktop pet app. It uses Electron to show an animated transparent companion on the desktop.

![MitaDesktopPet on the desktop](docs/mita-desktop-preview.png)

## Download

Download the latest Windows installer from the GitHub release:

[MitaDesktopPet-2.0.1-Setup.exe](https://github.com/Andrej1707/MitaPet/releases/download/v2.0.1/MitaDesktopPet-2.0.1-Setup.exe)

## Features

- Transparent frameless always-on-top window
- Starts in the bottom-right corner
- Loads `assets/pet.json` and animates `assets/spritesheet.webp`
- Idle, walk, wave, excited, sad, pray, and shy modes
- Smooth requestAnimationFrame sprite animation
- Random wandering, hopping, emotes, and short click reactions
- Fading speech bubbles
- Mouse dragging with saved position
- Right-click menu with quit and Windows autostart toggle
- Double-click mini pet menu
- Optional tray icon
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
- Speech bubbles are locked to one at a time and Auto Vision skips while Mita is speaking

Screenshots are only sent when Vision Mode is enabled and you use Manual Ask or enable Auto Vision. Screenshots are captured from the primary screen, downscaled to JPEG, and are not stored permanently by MitaDesktopPet.

Do not enable Auto Vision when private content is visible. You can use Manual Ask instead of Auto Vision.

Vision Settings lets you:

- Enable or disable OpenAI Vision Mode
- Save or clear your API key
- Change the model
- Change image detail, width, and JPEG quality
- Enable or disable Auto Vision
- Change scan interval and cooldown
- Set daily and weekly request caps
- View and reset usage counters

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
dist/MitaDesktopPet-2.0.1-Setup.exe
```

## App Assets

- `assets/pet.json`
- `assets/spritesheet.webp`
