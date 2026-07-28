# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [0.1.0] - 2026-07-27

### Added

- First-run welcome dialog that is shown once and persisted in user settings.
- About dialog view with application version, build number, website, GitHub, and license.
- NSIS installer hook to launch the application after installation.
- Release metadata endpoint for frontend About and release documentation.
- Release build script for desktop installer bundling (`npm run build:desktop`).

### Changed

- Standardized release metadata across package, Cargo, and Tauri configuration.
- Hardened Windows installer configuration for NSIS output and production metadata.
- Added release profile optimization in Cargo for smaller binaries (`lto`, `strip`, `opt-level = "s"`, single codegen unit).
- Enabled Tauri build command pruning with `removeUnusedCommands` for production builds.
- Reduced production frontend log verbosity to warnings and errors only.
- Updated README with installation, requirements, shortcuts, known limitations, and source build instructions.

### Fixed

- Settings model parity between frontend and backend for first-run completion persistence.

[0.1.0]: https://github.com/screenscribble/screenscribble/releases/tag/v0.1.0
