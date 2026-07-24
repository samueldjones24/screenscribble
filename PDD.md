# ScreenScribble - Product Design Document (PDD)

**Version:** 0.1 (MVP)
**Status:** Draft
**Target Platform:** Windows (MVP)

---

# 1. Vision

## Overview

ScreenScribble is a lightweight desktop utility that allows users to temporarily draw directly over their desktop using a configurable activation gesture.

Unlike presentation software or screenshot editors, ScreenScribble is designed to be invisible until needed.

The primary interaction is:

> **Press → Draw → Release → Continue Working**

Annotations automatically disappear after a configurable amount of time, allowing users to highlight information without cluttering the screen.

The application should launch at startup, live in the system tray, consume minimal resources, and always be available.

---

# 2. Goals

## Primary Goals

- Allow users to annotate any application.
- Require zero application switching.
- Minimise interaction friction.
- Keep the application lightweight.
- Automatically clean up annotations.
- Be suitable for live demonstrations and presentations.

## Non-Goals (MVP)

The application is **not** intended to become:

- A whiteboard application
- An image editor
- A screenshot editor
- A note-taking application
- A presentation tool

Its focus is **temporary desktop annotation**.

---

# 3. Primary Use Cases

## 1. Screen Sharing

Example:

A developer is on a Teams call.

Instead of saying:

> "The button on the right..."

They hold the activation button, circle the button, release, and continue speaking.

The annotation disappears after 10 seconds.

---

## 2. Screenshot Annotation

A user:

- Opens a webpage
- Draws an arrow around an element
- Takes a screenshot
- Clears automatically afterwards

---

## 3. Technical Support

Support staff can:

- Circle menu items
- Highlight controls
- Explain workflows

without opening another application.

---

## 4. Teaching / Presentations

During training sessions users can quickly:

- underline text
- circle diagrams
- draw arrows

without interrupting the presentation.

---

# 4. User Experience Principles

ScreenScribble should feel:

- Instant
- Invisible
- Lightweight
- Responsive
- Temporary

The user should never feel like they are entering a "draw mode".

Drawing should feel like a natural extension of the mouse cursor.

---

# 5. Core Workflow

Default workflow:

```
Hold Middle Mouse Button
        │
        ▼
Overlay activates
        │
        ▼
Move mouse
        │
        ▼
Stroke is drawn
        │
        ▼
Release Middle Mouse
        │
        ▼
Overlay becomes click-through
        │
        ▼
Stroke remains visible
        │
        ▼
Stroke fades
        │
        ▼
Stroke disappears
```

No toolbars should appear during this workflow.

---

# 6. MVP Feature List

## Drawing

### Supported

- Freehand drawing

### Brush

Configurable:

- Colour
- Width
- Opacity

Brush should use:

- round joins
- round caps

Drawing should feel smooth.

---

## Annotation Lifetime

Annotation visibility is managed per session:

- last activity timestamp
- visible timeout
- fade duration
- optional timeout reset when a new stroke begins

Default:

10 seconds

Configurable:

- 5 seconds
- 10 seconds
- 30 seconds
- 60 seconds
- Never

Fade animation:

Default:

1 second

Optional:

Disabled

---

## Overlay Window

Requirements:

- Transparent
- Borderless
- Always on top
- Fullscreen
- Multi-monitor support
- Hardware accelerated
- Click-through when inactive

---

## Input

Default activation:

Hold Middle Mouse

Future supported activation methods:

- Ctrl + Middle Mouse
- Alt + Middle Mouse
- Shift + Middle Mouse
- Custom keyboard shortcut
- Toggle draw mode

---

## System Tray

Application should minimise to tray.

Tray menu:

- Open Settings
- Pause Drawing
- Clear Annotations
- Start With Windows
- Exit

---

# 7. Settings

The application includes a lightweight settings window.

Settings are stored as JSON in the user configuration directory.

Loading and resilience requirements:

- create defaults when the file is missing
- merge missing values from defaults
- validate and normalize invalid values
- if parsing fails, log and continue with defaults

Runtime update requirements:

- brush changes apply immediately to future strokes
- session timing changes apply immediately to annotation lifecycle
- input activation changes apply where supported

## Activation

```
Activation

(•) Hold Middle Mouse

( ) Ctrl + Middle Mouse

( ) Alt + Middle Mouse

( ) Shift + Middle Mouse

( ) Custom Shortcut

Shortcut:

[ Ctrl + Shift + D ]
```

---

## Brush

```
Colour

[ Colour Picker ]

Brush Width

1 ──────────────●───────────── 20

Opacity

0% ─────────────●─────────────100%
```

---

## Lifetime

```
Visible For

5 seconds

10 seconds

30 seconds

60 seconds

Never

Fade

☑ Enabled

Fade Duration

0.5 sec

1 sec

2 sec
```

---

## General

```
☑ Launch at Windows startup

☑ Draw across all monitors

☑ Minimise to system tray
```

Current implementation note:

- MVP currently includes launch/start-minimised/debug settings in the General section.

---

# 8. Architecture

## Technology Stack

Desktop

- Tauri 2

Backend

- Rust

Frontend

- TypeScript

Rendering

- HTML5 Canvas

Configuration

- JSON

Settings management

- SettingsService + backend command handlers

Build

- Cargo
- npm

---

# 9. High-Level Components

```
ScreenScribble

├── Overlay Window

│   ├── Canvas

│   ├── Renderer

│   └── Animation

│

├── Global Input

│   ├── Mouse Hook

│   └── Shortcut Manager

│

├── Settings

│   ├── Config Manager

│   └── Preferences UI

│

├── Tray

│   ├── Menu

│   └── Notifications

│

└── Storage

    └── settings.json
```

---

# 10. Drawing Engine

Each stroke should be represented by:

```typescript
interface Stroke {
  id: string;
  points: Point[];
  colour: string;
  width: number;
  opacity: number;
  createdAt: number;
  expiresAt: number;
}
```

Each point:

```typescript
interface Point {
  x: number;
  y: number;
}
```

Rendering loop:

- Draw active strokes
- Calculate fade
- Remove expired strokes

---

# 11. Configuration

Settings should persist.

Suggested JSON:

```json
{
  "schemaVersion": 1,
  "brush": {
    "colour": "#ff0000",
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
    "launchAtStartup": true
  }
}
```

---

# 12. Project Structure

```
screenscribble/

├── README.md

├── PRODUCT_DESIGN.md

├── package.json

├── src/

│   ├── drawing/

│   │   ├── renderer.ts

│   │   ├── canvas.ts

│   │   ├── stroke.ts

│   │   └── animation.ts

│   │

│   ├── settings/

│   │   ├── settings.ts

│   │   └── SettingsWindow.ts

│   │

│   ├── tray/

│   │

│   └── main.ts

│

└── src-tauri/

    ├── src/

    │   ├── main.rs

    │   ├── overlay.rs

    │   ├── mouse_hook.rs

    │   ├── config.rs

    │   ├── tray.rs

    │   └── startup.rs

    │

    └── tauri.conf.json
```

---

# 13. Milestones

## Milestone 1

Project setup

Deliverables:

- Tauri project
- Settings window
- Tray icon
- Transparent overlay

---

## Milestone 2

Drawing engine

Deliverables:

- Canvas rendering
- Mouse drawing
- Stroke storage
- Brush settings

---

## Milestone 3

Global mouse hook

Deliverables:

- Detect middle mouse globally
- Activate overlay
- Click-through mode

---

## Milestone 4

Temporary annotations

Deliverables:

- Stroke lifetime
- Fade animation
- Automatic cleanup

---

## Milestone 5

Configuration

Deliverables:

- Persistent settings
- Startup option
- Shortcut configuration

---

# 14. Future Features

## Drawing Tools

- Arrow
- Rectangle
- Ellipse
- Straight line
- Highlighter
- Text
- Laser pointer

---

## Screenshot Mode

Workflow:

Capture

↓

Annotate

↓

Save

↓

Copy to clipboard

---

## Presentation Mode

Persistent annotations until manually cleared.

---

## Shapes

Keyboard modifiers:

Shift

→ Straight line

Ctrl

→ Rectangle

Alt

→ Circle

---

## Advanced Features

- Pressure-sensitive stylus support
- Pen tablets
- Multiple brush presets
- Colour palette hotkeys
- Undo
- Redo
- Export annotations
- Screen recording compatibility
- Dark/light themes

---

# 15. Definition of Done

The MVP is complete when a user can:

1. Install ScreenScribble.
2. Launch it.
3. Find it in the system tray.
4. Hold the configured activation button (default: Middle Mouse).
5. Draw on top of any application.
6. Release the button.
7. Continue interacting with their desktop immediately.
8. Watch the annotation automatically fade away.
9. Configure brush size, colour, timeout and activation method.
10. Relaunch the application and retain all settings.

---

# 16. Design Philosophy

Every feature should satisfy the following question:

> "Does this help the user annotate something in under two seconds?"

If the answer is **no**, the feature likely belongs in a future release rather than the MVP.

ScreenScribble should remain a fast, focused utility rather than evolving into a full drawing or presentation application.

The guiding principle for every design decision is:

**Press. Draw. Release. Continue.**

---

# 17. Known MVP Risks And Bugs

## Overlay Native Chrome Regression (Windows)

Status:

- Resolved

Summary:

- The overlay window intermittently displayed a native top title strip/chrome on Windows when running transparent fullscreen overlay mode.

Root cause:

- Windows compositor/WebView2 interaction with transparent + fullscreen overlay lifecycle.

Fix:

1. Removed fullscreen mode from the overlay window configuration.
2. Switched to monitor-sized borderless positioning/sizing at startup.
3. Kept explicit transparent overlay frontend surface styling.

Expected:

- Overlay remains fully borderless and invisible except for annotation strokes.

Actual (before fix):

- A native top chrome strip could reappear and obstruct content.

MVP impact:

- High. This conflicts with core UX principles: invisible, lightweight, non-intrusive overlay.

Verification:

1. No visible native overlay chrome across repeated transitions (draw/release, focus changes, settings interactions) in development validation.

Follow-up:

1. Re-validate in packaged Windows builds as part of pre-release checklist.
2. Keep a short regression checklist for overlay lifecycle changes.
