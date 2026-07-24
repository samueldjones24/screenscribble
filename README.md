# ScreenScribble

> "ScreenScribble is a transient desktop annotation layer for meetings, demos, and screenshots — press, draw, release, and move on."

## Project status

This repository now contains a working Tauri 2 + Rust + TypeScript implementation with:

- Global desktop drawing in an overlay window
- Click-through overlay behavior when not drawing
- Session-based annotation fade/expiry lifecycle
- Persistent JSON-backed settings with runtime updates
- Lightweight settings window

## Prerequisites

- Node.js 20+
- Rust toolchain (cargo)
- A Windows environment for the desktop build target

## Setup

```bash
npm install
```

## Development

Start the web frontend on the local dev port:

```bash
npm run dev
```

Or use the explicit frontend shortcut:

```bash
npm run dev:frontend
```

Run the desktop app in development mode:

```bash
npm run dev:desktop
```

Or start the frontend and desktop app together from PowerShell:

```powershell
npm run dev:all
```

## Why npx can fail in PowerShell

On this Windows setup, PowerShell is blocking script-based executables from the Node installation, so commands like `npx` can fail with an execution-policy error. Using the local shims such as `npm.cmd` and the project scripts avoids that problem.

## Build

Create a production build:

```bash
npm run build
```

## Project structure

- src/ contains the TypeScript frontend modules
- src/drawing/ contains the drawing engine, renderer, canvas, tools, brush manager, and annotation session
- src/settings/ contains settings model, settings service, and settings window UI
- src/tray/ contains the tray integration scaffold
- src-tauri/ contains the Rust backend and Tauri configuration

## Architecture snapshot

Runtime flow:

Global input hook -> Overlay input controller -> DrawingEngine -> ToolManager -> PenTool -> AnnotationSession -> Renderer

Settings flow:

Settings window -> SettingsService -> Rust command save_settings -> settings.json -> broadcast settings-updated event -> Overlay applies changes at runtime

## Configuration lifecycle

1. On startup, backend `load_settings` resolves the app config directory and attempts to read `settings.json`.
2. If no file exists, defaults are written.
3. If a file exists, values are merged with defaults and normalized.
4. Invalid or out-of-range values are clamped to safe defaults.
5. Missing fields are migrated and persisted back to disk.
6. If parsing fails, the app logs and continues with defaults.

## Settings persistence

- File name: `settings.json`
- Directory: platform app config directory resolved by Tauri (`app.path().app_config_dir()`)
- Windows example: `%APPDATA%/com.screenscribble.app/settings.json`
- Save strategy: write temporary file then rename (atomic where practical)

## Runtime update behavior

When settings are saved:

1. Backend validates and persists normalized settings.
2. Backend emits `screen_scribble:settings-updated` to `main`, `overlay`, and `settings` windows.
3. Overlay immediately applies:
	 - Brush: color, width, opacity
	 - Session timing: timeout and fade

No restart is required for these supported settings.

## Validation rules

- Brush width: `1..64`
- Brush opacity: `0..100` percent
- Session timeout: `1..600` seconds
- Session fade: `0..600` seconds and never greater than timeout

- Brush color must be a valid hex color (`#RRGGBB`)

## Settings schema

```json
{
  "schemaVersion": 1,
  "brush": {
    "colour": "#f43f5e",
    "width": 5,
    "opacity": 95
  },
  "session": {
    "timeoutSeconds": 10,
    "fadeSeconds": 1,
    "resetTimeoutOnNewStroke": true
  },
  "input": {},
  "general": {
    "launchAtStartup": false
  }
}
```

## Migration strategy

Configuration versioning:

- Each settings file includes a `schemaVersion` field (currently `1`).
- On load, the backend merges user settings with defaults and validates all fields.
- Missing fields are populated from defaults and persisted back to disk.
- Invalid values are clamped to safe ranges.
- As the application evolves, future schema versions (v2, v3, etc.) can migrate settings stepwise without data loss.
- Future migrations will check `schemaVersion` and apply transformations as needed.

## How to Draw

1. **Start Drawing**: Click "Start Drawing" in the tray menu or press Ctrl+Shift+X to enable the overlay
2. **Draw**: Left-click and drag on the screen to annotate
3. **Stop Drawing**: Click "Stop Drawing" in the tray menu or press Ctrl+Shift+X to disable the overlay

You can pause the session (Ctrl+Shift+R) to temporarily stop recording strokes without hiding the overlay, or clear the screen (Ctrl+Shift+Z) to erase all strokes.

## Keyboard Shortcuts

All shortcuts require the modifier keys pressed together with the letter (e.g., hold Ctrl and Shift, then press X):

| Shortcut | Action |
|----------|--------|
| **Ctrl+Shift+X** | Toggle drawing overlay visibility (Start/Stop Drawing) |
| **Ctrl+Shift+R** | Pause/resume current drawing session |
| **Ctrl+Shift+Z** | Clear all strokes from the current session |

## System Tray

ScreenScribble runs minimized as a system tray icon. Right-click the tray icon to access:

- **Start Drawing / Stop Drawing** — Enable or disable the overlay window. Label changes based on current state. Shortcut: Ctrl+Shift+X
- **Pause / Resume** — Temporarily stop recording strokes without clearing the canvas.
- **Clear Screen** — Erase all strokes from the current drawing session.
- **Settings** — Open the settings window to customize brush, session timing, and other preferences.
- **Exit** — Shut down the application cleanly.

All menu items display their corresponding keyboard shortcuts for quick reference.

## Installation

### Building from source

```bash
git clone https://github.com/yourusername/screenscribble
cd screenscribble
npm install
npm run build
```

After a successful build, the application installer can be packaged from the `src-tauri/target/release/bundle/` directory.

### First launch

1. Launch the application.
2. The overlay window will appear and the tray icon will activate.
3. Open Settings (right-click tray → Settings) to configure:
   - Brush style (color, width, opacity)
   - Session behavior (timeout, fade speed, auto-reset)
4. Optionally enable "Launch at startup" to auto-run on system boot.
5. Close the settings window—changes apply immediately.

## Troubleshooting

### Overlay not appearing

1. Check that draw mode is enabled:
  - Right-click the system tray icon and confirm "Draw Mode: On"
   - Or press **Ctrl+Shift+X** to toggle
2. Verify the overlay window is not behind other windows.
3. If using multiple monitors, the overlay launches on the primary monitor. Move it if needed.
4. Check Windows Defender or third-party antivirus has not quarantined the global input hooks.

### Global keyboard shortcuts not responding

1. The global input hooks require Windows permissions. Restart the application.
2. If shortcuts still fail, check that another application is not intercepting them (e.g., gaming overlays, accessibility tools).
3. Confirm UAC did not block hook installation. Check that the application is running with normal user privileges.

### Settings file corruption

If the application fails to load settings:

1. A backup log message appears in the console (dev builds only).
2. The application continues with hardcoded defaults.
3. Manually delete the corrupted file:
   - Windows: `%APPDATA%/com.screenscribble.app/settings.json`
   - Restart the application; defaults will be written.

### Drawing feels laggy or unresponsive

1. Reduce brush width or disable "Reset timeout on new stroke" to lower session overhead.
2. Check background processes consuming CPU (Task Manager → Performance).
3. Update to the latest graphics drivers if the rendering backend reports WebView2 or GPU acceleration issues.
4. On lower-end systems, reduce the session timeout to minimize in-memory stroke data.

### Application crashes on startup

1. Check that Windows 11 WebView2 runtime is installed. Download from [Microsoft WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).
2. Clear the settings file (see **Settings file corruption** above) and restart.
3. If the issue persists, run the application from a terminal to see error messages:
   ```powershell
   cd src-tauri
   cargo run --release
   ```

## Known Limitations

- **Windows only** — ScreenScribble uses Windows-specific global input hooks and Tauri's Windows backend. macOS and Linux are not currently supported.
- **Primary monitor only** — The overlay appears on the primary monitor only. Multi-monitor layouts require manual window repositioning.
- **No cross-session persistence** — Drawings are not saved between application restarts. Consider taking a screenshot before closing if you need to preserve annotations.
- **Single global hotkey set** — Keyboard shortcuts are hardcoded and not customizable (yet). All users have identical shortcuts.
- **Rendering limited by WebView2** — Complex, high-frequency stroke input may cause visual jitter on systems with lower-end GPU resources.

## Next milestones

- Tray integration for opening settings
- Additional input shortcut parsing and richer keyboard shortcut support
- Optional schema versioning and explicit migration pipeline

## Known MVP gaps

- Resolved (Windows): overlay top title strip/chrome regression caused by transparent + fullscreen overlay lifecycle on WebView2/DWM.
- Fix applied: removed fullscreen overlay mode, set monitor-sized borderless geometry at startup, and kept explicit transparent overlay surface styling.
- Verification: repeated draw/release and focus/interaction transitions now keep the overlay borderless.

## Tray QA and State Transition Coverage

- Manual tray validation runbook: [docs/tray-qa-checklist.md](docs/tray-qa-checklist.md)
- Backend runtime state transition tests: [src-tauri/src/runtime_state.rs](src-tauri/src/runtime_state.rs)
