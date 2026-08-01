# ScreenScribble

Transient desktop annotation for meetings, demos, and screenshots.

ScreenScribble runs in your Windows system tray and lets you draw over your desktop without switching applications.

## Version

Current release candidate: **0.1.0**

## Installation

### Windows installer

1. Download `ScreenScribble-Setup.exe` from the GitHub Releases page.
2. Run the installer.
3. Complete setup. ScreenScribble starts after installation.
4. Find ScreenScribble in the Start Menu and system tray.

### User install experience

From a user perspective, setup looks like this:

1. Click Download on the website or download the installer from GitHub Releases.
2. Open the installer and confirm any Windows security prompt.
3. Let ScreenScribble install for the current Windows user.
4. If WebView2 is not already installed, let the installer fetch it automatically.
5. Finish setup and allow ScreenScribble to launch.
6. ScreenScribble starts in the background and appears in the system tray.
7. Open Settings or About from the tray menu when needed, or press `Ctrl + Alt + D` to toggle Draw Mode.

### Uninstall

- Use Windows Settings -> Apps -> Installed apps -> ScreenScribble -> Uninstall.
- Or use Control Panel -> Programs and Features.

## System Requirements

- Windows 10 or Windows 11 (64-bit)
- Microsoft Edge WebView2 runtime (installed automatically on most systems)
- Mouse input device

## Keyboard Shortcuts

Default shortcuts:

- `Ctrl + Alt + D` - Toggle Draw Mode (start/stop drawing)
- `Ctrl + Alt + P` - Pause or resume the current drawing session
- `Ctrl + Alt + C` - Clear current annotations

You can change shortcuts in Settings.

## Startup Experience

After installation, ScreenScribble starts and runs from the system tray.

Open Settings or About from the tray menu when needed.

## Known Limitations

- Windows only (no macOS/Linux support in 0.1.0)
- Primary monitor focused workflow
- Annotations are temporary and not persisted across app restarts
- No advanced shape/text tools in this release

## Building From Source

### Prerequisites

- Node.js 20+
- Rust toolchain (stable)
- Windows environment for desktop bundling

### Setup

```bash
npm install
```

### Development

```bash
npm run dev:desktop
```

### Run tests

```bash
npm test
```

### Build frontend

```bash
npm run build
```

### Build Windows installer

```bash
npm run build:desktop
```

Installer artifacts are generated under:

- the Tauri release bundle output directory ending in `release/bundle/nsis/` (path varies by Cargo target configuration; see the `npm run build:desktop` output for the exact location).

## Release Metadata

- Website: https://screenscribble.app
- Support: https://github.com/screenscribble/screenscribble/issues
- Repository: https://github.com/screenscribble/screenscribble
- License: MIT

## Project Structure

- `src/` - TypeScript frontend (overlay, settings UI, input handling)
- `src-tauri/` - Rust/Tauri backend and bundling configuration
- `tests/` - TypeScript unit/integration-style tests
- `docs/` - QA and release process notes
