# ScreenScribble

Transient desktop annotation for meetings, demos, and screenshots.

ScreenScribble runs in your Windows system tray and lets you draw over your desktop without switching applications.

## Version

Current release candidate: **0.1.0**

## Installation

### Windows installer

1. Download either `ScreenScribble-Setup.exe` (stable filename) or `ScreenScribble_<version>_x64-setup.exe` from the GitHub Releases page.
2. Run the installer.
3. Complete setup. ScreenScribble starts after installation.
4. Find ScreenScribble in the Start Menu and system tray.

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

## First Run Experience

On first launch, ScreenScribble shows a welcome dialog once.

It includes:

- Quick usage guidance
- The default Draw Mode shortcut
- A direct button to open Settings

After dismissal, it is not shown again.

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
