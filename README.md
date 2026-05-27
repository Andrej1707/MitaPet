# MitaDesktopPet

MitaDesktopPet is a standalone Windows desktop pet app. It uses Electron to show an animated transparent companion on the desktop.

## Download

Download the latest Windows installer from the GitHub release:

[MitaDesktopPet-1.0.0-Setup.exe](https://github.com/Andrej1707/MitaPet/releases/download/v1.0.0/MitaDesktopPet-1.0.0-Setup.exe)

## Features

- Transparent frameless always-on-top window
- Starts in the bottom-right corner
- Loads `assets/pet.json` and animates `assets/spritesheet.webp`
- Idle, walk, sleep, and excited modes
- Random wandering, hopping, and short click reactions
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
dist/MitaDesktopPet-1.0.0-Setup.exe
```

## App Assets

- `assets/pet.json`
- `assets/spritesheet.webp`
