# MitaDesktopPet

MitaDesktopPet is a standalone Windows desktop pet app. It uses Electron to show an animated transparent companion on the desktop.

![MitaDesktopPet on the desktop](docs/mita-desktop-preview.png)

## Download

Download the latest Windows installer from the GitHub release:

[MitaDesktopPet-1.2.0-Setup.exe](https://github.com/Andrej1707/MitaPet/releases/download/v1.2.0/MitaDesktopPet-1.2.0-Setup.exe)

## Features

- Transparent frameless always-on-top window
- Starts in the bottom-right corner
- Loads `assets/pet.json` and animates `assets/spritesheet.webp`
- Idle, walk, wave, excited, sad, pray, and shy modes
- Smooth requestAnimationFrame sprite animation
- Random wandering, hopping, emotes, and short click reactions
- Fading speech bubbles
- Optional Screen Awareness mode with local screen heuristics
- Optional Game Tips mode for HUD-like situations
- Configurable screenshot interval, default 10 seconds
- Optional local Puddle/PaddleOCR hook when available
- Screen capture is off by default and screenshots are not stored permanently
- Mouse dragging with saved position
- Right-click menu with quit and Windows autostart toggle
- Double-click mini pet menu
- Optional tray icon
- Windows installer prepared with electron-builder

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
dist/MitaDesktopPet-1.2.0-Setup.exe
```

## App Assets

- `assets/pet.json`
- `assets/spritesheet.webp`
