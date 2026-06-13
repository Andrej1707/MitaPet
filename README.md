# Mita-Pet

Mita-Pet is an open-source Windows desktop companion: a small animated character
that lives on the screen, reacts to clicks and desktop moments, and can optionally
use screen awareness and push-to-talk voice features.

The project is built around ambient presence rather than a permanent chat window.
Mita can wander, emote, show short overlay reactions, remember useful session
context, and stay quiet when focus matters.

## Project Website

The public project website lives in [`site/`](site/) and is deployed with GitHub
Pages:

**Expected URL:** <https://andrej1707.github.io/MitaPet/>

The website is a React + TypeScript + Vite application with:

- an interactive desktop-event simulator;
- mood and personality controls;
- screen-awareness and privacy explanations;
- roadmap, install instructions, FAQ, and project links;
- responsive desktop, tablet, and mobile layouts;
- keyboard focus states and reduced-motion support.

### Run the Website Locally

```powershell
cd site
npm install
npm run dev
```

### Validate the Website

```powershell
cd site
npm run typecheck
npm run build
```

Vite uses the `/MitaPet/` base path because that is the exact GitHub repository
name. The workflow in `.github/workflows/deploy-pages.yml` builds `site/` and
deploys `site/dist` whenever website files are pushed to `main`.

## Desktop App

MitaDesktopPet uses Electron to display an animated, transparent, always-on-top
companion on Windows.

![MitaDesktopPet on the desktop](docs/mita-desktop-preview.png)

### Download

Download the latest Windows installer from the
[GitHub Releases page](https://github.com/Andrej1707/MitaPet/releases/latest).

### Core Features

- Transparent frameless always-on-top window
- Animated sprite modes including idle, walk, wave, excited, sad, pray, and shy
- Random wandering, hopping, emotes, and click reactions
- Responsive speech bubbles and larger Vision reaction bubbles
- Mouse dragging with saved position
- Windows autostart, tray icon, and desktop shortcuts
- Optional OpenAI Vision Mode, disabled by default
- Optional push-to-talk Voice Mode, disabled by default
- Optional OpenAI text-to-speech output, disabled by default

## Screen Awareness and Privacy

Vision features are optional. Mita-Pet still works as an animated desktop
companion without an API key.

Screen captures happen only when Vision Mode is enabled and the user triggers
Manual Ask or explicitly enables Auto Vision.

Current privacy behavior:

- Auto Vision is off by default.
- The configured interval and current status are visible in settings.
- Mita hides her overlay before a screenshot so she does not analyze herself.
- Screenshots are downscaled to JPEG before a request.
- Screenshots are not permanently stored by MitaDesktopPet.
- Daily and weekly request limits are configurable.
- The saved API key can be cleared at any time.

Do not enable Auto Vision while private information is visible. Manual Ask is the
safer choice for occasional context.

## Voice Mode

Voice Chat Mode is optional, push-to-talk only, and disabled by default. It uses
the same locally saved OpenAI API key as Vision Mode, with separate model and
usage settings.

- Default push-to-talk key: `F8`
- No wake word
- No continuous listening
- Audio is sent only while the push-to-talk key is held
- Audio is not permanently stored by MitaDesktopPet
- Text-to-speech output is optional

## Run the Desktop App

```powershell
npm install
npm start
```

## Test

```powershell
npm test
npm audit --audit-level=high
```

## Build the Windows Installer

```powershell
npm run dist
```

The installer is written to `dist/`.

## Repository Structure

```text
.
|-- .github/workflows/   GitHub Pages deployment
|-- assets/              Desktop pet animation assets
|-- docs/                Project screenshots
|-- scripts/             Desktop app smoke and capture tests
|-- site/                Public React/Vite project website
|-- src/                 Electron desktop application
|-- LICENSE
`-- README.md
```

## License

Mita-Pet is available under the [MIT License](LICENSE).
