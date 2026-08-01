# ScreenScribble 0.1.0 Release Checklist

## Build and Packaging

- [ ] Confirm versions are `0.1.0` in:
  - [ ] `package.json`
  - [ ] `src-tauri/Cargo.toml`
  - [ ] `src-tauri/tauri.conf.json`
- [ ] Run `npm ci`
- [ ] Run `npm test`
- [ ] Run `npm run build`
- [ ] Run `npm run build:desktop`
- [ ] Verify installer artifact exists in the Tauri release bundle output directory ending in `release/bundle/nsis/` (confirm exact path from `npm run build:desktop` output)

## Installer Validation (Clean Machine)

- [ ] Run installer as a normal user
- [ ] Verify app icon appears correctly in installer and installed app
- [ ] Verify Start Menu shortcut is created
- [ ] Verify Desktop shortcut behavior (optional selection in installer UI)
- [ ] Verify app launches after install completion
- [ ] Verify uninstall entry appears in Windows Installed Apps

## Runtime Validation

- [ ] App appears in system tray after startup
- [ ] No unexpected foreground window appears on startup
- [ ] Settings opens correctly from the tray menu
- [ ] Draw Mode toggle works (`Ctrl + Alt + D`)
- [ ] Drawing works and fades according to settings
- [ ] Settings persist across app restart
- [ ] About view (tray -> About) shows version, build, website, GitHub, license
- [ ] Exit from tray shuts down app cleanly

## Uninstall and Reinstall

- [ ] Uninstall removes binaries and shortcuts
- [ ] Reinstall succeeds without stale-version prompts
- [ ] App runs after reinstall

## GitHub Release Preparation

- [ ] Tag created: `v0.1.0`
- [ ] Release title: `ScreenScribble 0.1.0`
- [ ] CHANGELOG section copied to release notes
- [ ] Attach installer asset(s):
  - [ ] `ScreenScribble-Setup.exe`
- [ ] Optional checksums attached
- [ ] Publish release
