# Tray QA Checklist

This checklist is for tray-first runtime validation.

## Scope

- Startup behavior
- Tray responsiveness
- Pause/resume semantics
- Session clear behavior
- Settings window behavior
- Exit lifecycle behavior

## Environment

- Platform: Windows
- Build mode: development and packaged build
- Preconditions:
  - Existing settings file present
  - Overlay and global input hooks enabled

## Test Cases

1. Startup
- Launch app.
- Confirm tray icon appears.
- Confirm no unexpected foreground window appears.
- Expected:
  - Tray icon visible.
  - App can run from tray.

2. Runtime drawing baseline
- Draw with default activation.
- Expected:
  - Strokes render normally.
  - Session fade/expiry unchanged.

3. Pause Drawing semantics
- Draw one or more strokes.
- From tray, click Pause Drawing.
- Try starting a new stroke.
- Expected:
  - New drawing does not start.
  - Existing annotations remain visible and continue normal session lifecycle.
  - Tray state shows Paused and Resume Drawing is enabled.

4. Resume Drawing
- From Paused state, click Resume Drawing.
- Draw immediately.
- Expected:
  - New drawing works immediately.
  - Tray state shows Running.

5. Clear Current Session
- Draw one or more strokes.
- From tray, click Clear Current Session.
- Expected:
  - Visible annotations are removed immediately.
  - App remains running.
  - Brush/tool/settings are unchanged.

6. Open Settings
- Click Open Settings from tray repeatedly.
- Expected:
  - Existing settings window is focused.
  - Duplicate settings windows are not created.

7. Startup toggle integration
- Click Enable At Startup.
- Restart app.
- Confirm launch preference persisted.
- Click Disable At Startup.
- Restart app.
- Expected:
  - Preference persists and tray items reflect current state.

8. Exit lifecycle
- While drawing is idle, click Exit.
- Relaunch and repeat during active usage.
- Expected:
  - App terminates cleanly.
  - No orphan process remains.
  - Tray icon is removed.

## Edge Cases to Capture

- Pausing while a stroke is in progress.
- Rapid Pause/Resume toggles.
- Clear Session while paused.
- Open Settings immediately before Exit.
- Toggle startup setting while settings window is open.

## Current Session Notes

- Automated compile checks passed after tray and pause semantics changes.
- Interactive tray operations require manual validation on host desktop session.

## Milestone Delta Checks (Draw Mode + Tray UX)

1. Draw Mode naming consistency
- Open tray menu.
- Expected:
  - User-facing wording uses "Draw Mode" (not "Drawing Mode") where applicable.

2. First-toggle notification
- Fresh app launch.
- Toggle Draw Mode ON once.
- Expected:
  - `Draw Mode: ON` notification appears on first toggle.

3. Tray fallback while Draw Mode is active
- Turn Draw Mode ON.
- Open tray menu and click Pause/Stop/Clear using mouse.
- Expected:
  - Tray items remain clickable while Draw Mode is active.
  - Action executes immediately without requiring keyboard shortcut fallback.

4. Clear Screen after taskbar-edge drawing
- Start a stroke away from the taskbar and drag into taskbar edge region.
- Trigger Clear Screen from tray and from shortcut in separate attempts.
- Expected:
  - All visible strokes clear fully.
  - No residual color line remains at taskbar edge.

5. Shortcut + tray state sync
- Toggle Draw Mode from tray.
- Toggle Draw Mode from shortcut.
- Repeat while switching pause/resume.
- Expected:
  - Tray labels and runtime behavior stay in sync.
  - Draw Mode can always be toggled off from shortcut after tray interactions.
