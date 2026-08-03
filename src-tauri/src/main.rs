#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{command, Manager, Position, Size};

mod application_controller;
mod diagnostics;
mod input;
mod logging;
mod runtime_state;
mod settings;
mod shortcut;
mod startup;

use application_controller::AppControllerState;

fn harden_overlay_webview_window(window: &tauri::WebviewWindow) {
    // Re-assert critical overlay flags to avoid native chrome returning after state changes.
    let _ = window.set_title("");
    let _ = window.set_decorations(false);
    let _ = window.set_shadow(false);
    let _ = window.set_resizable(false);
    let _ = window.set_always_on_top(true);
    let _ = window.set_focusable(false);
    let _ = window.set_ignore_cursor_events(true);
}

fn harden_overlay_window(window: &tauri::Window) {
    // Re-assert critical overlay flags to avoid native chrome returning after state changes.
    let _ = window.set_title("");
    let _ = window.set_decorations(false);
    let _ = window.set_shadow(false);
    let _ = window.set_resizable(false);
    let _ = window.set_always_on_top(true);
    let _ = window.set_focusable(false);
    let _ = window.set_ignore_cursor_events(true);
}

#[command]
fn ping_backend(message: String) -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    logging::log_backend(&format!("received ping: {message} at {now}"));
    format!("Backend acknowledged: {message} at {now}")
}

#[command]
fn toggle_overlay_state(app: tauri::AppHandle, controller_state: tauri::State<'_, AppControllerState>) -> bool {
    controller_state.with_mut(|controller| controller.toggle_pause_state(&app))
}

#[command]
fn exit_application(app: tauri::AppHandle, controller_state: tauri::State<'_, AppControllerState>) {
    controller_state.with_mut(|controller| controller.shutdown(&app));
}

#[command]
fn force_overlay_clickthrough(app: tauri::AppHandle) {
    input::set_overlay_clickthrough_state(&app, true);
}

#[command]
fn load_settings(app: tauri::AppHandle) -> settings::ApplicationSettings {
    settings::load_settings(&app)
}

#[command]
fn save_settings(
    app: tauri::AppHandle,
    controller_state: tauri::State<'_, AppControllerState>,
    settings: settings::ApplicationSettings,
) -> settings::ApplicationSettings {
    let saved = settings::save_settings(&app, settings);
    settings::emit_settings_updated(&app, &saved);
    controller_state.with_mut(|controller| controller.sync_from_settings(&app, &saved));
    saved
}

#[command]
fn open_settings_window(
    app: tauri::AppHandle,
    controller_state: tauri::State<'_, AppControllerState>,
) -> Result<(), String> {
    controller_state.with_mut(|controller| controller.open_settings(&app))
}

#[command]
fn sync_input_state(
    app: tauri::AppHandle,
    controller_state: tauri::State<'_, AppControllerState>,
) {
    controller_state.with_mut(|controller| controller.sync_input_state(&app));
}

#[command]
fn get_diagnostics() -> diagnostics::ApplicationDiagnostics {
    diagnostics::collect_diagnostics()
}

#[command]
fn get_release_metadata() -> diagnostics::ReleaseMetadata {
    diagnostics::collect_release_metadata()
}

#[command]
fn open_external_url(url: String) -> Result<(), String> {
    webbrowser::open(&url).map_err(|error| format!("failed to open url: {error}"))
}

fn main() {
    tauri::Builder::default()
        .manage(AppControllerState::new())
        .setup(|app| {
            let startup_settings = settings::load_settings(&app.handle());
            let diagnostics = diagnostics::collect_diagnostics();
            logging::log_backend(&format!(
                "startup: application={} schema={} os={} arch={}",
                diagnostics.application_version,
                diagnostics.schema_version,
                diagnostics.operating_system,
                diagnostics.arch
            ));

            if let Some(overlay_window) = app.get_webview_window("overlay") {
                if let Some(primary_monitor) = app.primary_monitor()? {
                    let _ = overlay_window.set_position(Position::Physical(*primary_monitor.position()));
                    let _ = overlay_window.set_size(Size::Physical(*primary_monitor.size()));
                }

                harden_overlay_webview_window(&overlay_window);
            }

            if let Some(main_window) = app.get_webview_window("main") {
                let _ = main_window.hide();
            }

            {
                let controller_state: tauri::State<'_, AppControllerState> = app.state();
                if let Err(error) =
                    controller_state.with_mut(|controller| controller.initialize(&app.handle(), &startup_settings))
                {
                    return Err(std::io::Error::new(std::io::ErrorKind::Other, error).into());
                }
            }

            let handle = app.handle();
            if let Err(error) = input::install_global_mouse_hook(&handle) {
                logging::log_backend(&format!("failed to install global input hooks: {error}"));
            }
            Ok(())
        })
        .on_window_event(|_window, event| {
            if _window.label() == "overlay"
                && matches!(
                    event,
                    tauri::WindowEvent::Focused(_)
                        | tauri::WindowEvent::Resized(_)
                        | tauri::WindowEvent::Moved(_)
                        | tauri::WindowEvent::ScaleFactorChanged { .. }
                )
            {
                harden_overlay_window(_window);
            }

        })
        .invoke_handler(tauri::generate_handler![
            ping_backend,
            toggle_overlay_state,
            exit_application,
            force_overlay_clickthrough,
            load_settings,
            save_settings,
            open_settings_window,
            sync_input_state,
            get_diagnostics,
            get_release_metadata,
            open_external_url
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|error| eprintln!("error while running tauri application: {error}"));
}
