use std::sync::Mutex;

use serde::Serialize;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIcon, TrayIconBuilder};
use tauri::{AppHandle, Emitter, Manager, State, Wry};

use crate::input;
use crate::logging;
use crate::runtime_state::{AppRuntimeState, RuntimeAction};
use crate::settings;
use crate::startup;

const MENU_SESSION_TOGGLE_ID: &str = "tray_session_toggle";
const MENU_DRAWING_MODE_TOGGLE_ID: &str = "tray_drawing_mode_toggle";
const MENU_CLEAR_SESSION_ID: &str = "tray_clear_current_session";
const MENU_OPEN_SETTINGS_ID: &str = "tray_open_settings";
const MENU_EXIT_ID: &str = "tray_exit";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionControlEvent {
    kind: String,
}

struct TrayMenuHandles {
    session_toggle: MenuItem<Wry>,
    drawing_mode_toggle: MenuItem<Wry>,
}

struct TrayResources {
    icon: TrayIcon<Wry>,
    handles: TrayMenuHandles,
}

#[derive(Default)]
struct OverlayService;

impl OverlayService {
    fn prepare_overlay_window(&self, app: &AppHandle<Wry>) {
        if let Some(window) = app.get_webview_window("overlay") {
            let _ = window.show();
            let _ = window.set_ignore_cursor_events(true);
        }
    }

    fn hide_overlay(&self, app: &AppHandle<Wry>) {
        if let Some(window) = app.get_webview_window("overlay") {
            let _ = window.hide();
        }
    }
}

#[derive(Default)]
struct InputService;

impl InputService {
    fn is_paused(&self) -> bool {
        input::is_drawing_paused()
    }

    fn toggle_paused(&self, app: &AppHandle<Wry>) -> bool {
        let paused = input::is_drawing_paused();
        input::set_pause_state(app, !paused);
        !paused
    }

    fn set_overlay_active(&self, app: &AppHandle<Wry>, enabled: bool) {
        input::set_overlay_active(app, enabled);
    }

    fn is_overlay_active(&self) -> bool {
        input::is_overlay_enabled()
    }

    fn set_overlay_clickthrough(&self, app: &AppHandle<Wry>, ignore_cursor: bool) {
        input::set_overlay_clickthrough_state(app, ignore_cursor);
    }

    fn stop_hooks(&self) {
        input::uninstall_global_mouse_hook();
    }
}

#[derive(Default)]
struct SessionService;

impl SessionService {
    fn clear_current_session(&self, app: &AppHandle<Wry>) {
        let payload = SessionControlEvent {
            kind: "clear_current_session".to_string(),
        };
        if let Some(window) = app.get_webview_window("overlay") {
            let _ = window.emit("screen_scribble:session-control", payload);
        }
    }

    fn shutdown(&self, app: &AppHandle<Wry>) {
        let payload = SessionControlEvent {
            kind: "shutdown".to_string(),
        };
        if let Some(window) = app.get_webview_window("overlay") {
            let _ = window.emit("screen_scribble:session-control", payload);
        }
    }
}

#[derive(Default)]
struct SettingsService;

impl SettingsService {
    fn settings_window_url(&self) -> Result<tauri::WebviewUrl, String> {
        #[cfg(debug_assertions)]
        {
            let dev_url = tauri::Url::parse("http://127.0.0.1:1420/settings.html")
                .map_err(|error| format!("failed to parse settings dev url: {error}"))?;
            return Ok(tauri::WebviewUrl::External(dev_url));
        }

        #[cfg(not(debug_assertions))]
        {
            Ok(tauri::WebviewUrl::App("settings.html".into()))
        }
    }

    fn open_settings_window(&self, app: &AppHandle<Wry>) -> Result<(), String> {
        if let Some(window) = app.get_webview_window("settings") {
            window
                .show()
                .map_err(|error| format!("failed to show settings window: {error}"))?;
            window
                .set_focus()
                .map_err(|error| format!("failed to focus settings window: {error}"))?;
            return Ok(());
        }

        let settings_url = self.settings_window_url()?;

        tauri::WebviewWindowBuilder::new(
            app,
            "settings",
            settings_url,
        )
            .title("ScreenScribble Settings")
            .transparent(false)
            .skip_taskbar(false)
            .visible(true)
            .focused(true)
            .inner_size(860.0, 640.0)
            .min_inner_size(640.0, 520.0)
            .center()
            .resizable(true)
            .build()
            .map_err(|error| format!("failed to create settings window: {error}"))?;

        Ok(())
    }

}

#[derive(Default)]
struct ApplicationLifecycleService;

impl ApplicationLifecycleService {
    fn shutdown(&self, app: &AppHandle<Wry>, input_service: &InputService, overlay_service: &OverlayService, session_service: &SessionService) {
        logging::log_backend("lifecycle: graceful shutdown requested");
        session_service.shutdown(app);
        input_service.stop_hooks();
        overlay_service.hide_overlay(app);

        for label in ["settings", "main"] {
            if let Some(window) = app.get_webview_window(label) {
                let _ = window.hide();
                let _ = window.close();
            }
        }

        app.exit(0);
    }
}

#[derive(Default)]
struct StartupService;

impl StartupService {
    fn apply(&self, app: &AppHandle<Wry>, enabled: bool) {
        if let Err(error) = startup::apply_launch_at_startup(app, enabled) {
            logging::log_backend(&format!("startup registration update failed: {error}"));
        }
    }
}

#[derive(Default)]
struct AppServices {
    overlay: OverlayService,
    input: InputService,
    session: SessionService,
    settings: SettingsService,
    lifecycle: ApplicationLifecycleService,
    startup: StartupService,
}

pub struct ApplicationController {
    state: AppRuntimeState,
    overlay_active: bool,
    tray: Option<TrayResources>,
    services: AppServices,
}

impl Default for ApplicationController {
    fn default() -> Self {
        Self {
            state: AppRuntimeState::Starting,
            overlay_active: false,
            tray: None,
            services: AppServices::default(),
        }
    }
}

impl ApplicationController {
    pub fn initialize(&mut self, app: &AppHandle<Wry>, loaded_settings: &settings::ApplicationSettings) -> Result<(), String> {
        self.services
            .startup
            .apply(app, loaded_settings.general.launch_at_startup);
        self.services.overlay.prepare_overlay_window(app);
        self.overlay_active = self.services.input.is_overlay_active();

        // Initialize shortcuts from loaded settings
        let mut shortcut_bindings = std::collections::HashMap::new();
        for (action_str, binding) in &loaded_settings.shortcuts.bindings {
            if let Some(action) = crate::shortcut::ShortcutAction::from_string(action_str) {
                shortcut_bindings.insert(action, binding.clone());
            }
        }
        input::initialize_shortcuts(shortcut_bindings);

        let is_paused = self.services.input.is_paused();
        self.state = self.state.transition(RuntimeAction::StartupComplete {
            paused: is_paused,
        });

        // Emit initial state notifications to frontend
        input::set_pause_state(app, is_paused);
        input::set_overlay_active(app, self.overlay_active);

        self.initialize_tray(app)?;
        self.refresh_tray_state();

        logging::log_backend("tray: initialized");
        Ok(())
    }

    pub fn open_settings(&mut self, app: &AppHandle<Wry>) -> Result<(), String> {
        self.services.settings.open_settings_window(app)
    }

    pub fn toggle_pause_state(&mut self, app: &AppHandle<Wry>) -> bool {
        let paused = self.services.input.toggle_paused(app);
        self.state = if paused {
            self.state.transition(RuntimeAction::Pause)
        } else {
            self.state.transition(RuntimeAction::Resume)
        };
        self.refresh_tray_state();
        logging::log_backend(&format!("state: {}", if paused { "paused" } else { "running" }));
        !paused
    }

    pub fn set_overlay_active(&mut self, app: &AppHandle<Wry>, enabled: bool) {
        self.services.input.set_overlay_active(app, enabled);
        self.overlay_active = enabled;
        if enabled {
            self.state = self.state.transition(RuntimeAction::Resume);
        }
        self.refresh_tray_state();
        logging::log_backend(&format!("overlay: {}", if enabled { "on" } else { "off" }));
    }

    pub fn clear_current_session(&mut self, app: &AppHandle<Wry>) {
        self.services.session.clear_current_session(app);
        self.services.input.set_overlay_clickthrough(app, true);
        logging::log_backend("session: clear requested");
    }

    pub fn sync_from_settings(&mut self, app: &AppHandle<Wry>, settings: &settings::ApplicationSettings) {
        self.services
            .startup
            .apply(app, settings.general.launch_at_startup);
        self.refresh_tray_state();
    }

    pub fn sync_input_state(&mut self, _app: &AppHandle<Wry>) {
        self.overlay_active = self.services.input.is_overlay_active();
        let is_paused = self.services.input.is_paused();
        self.state = if is_paused {
            self.state.transition(RuntimeAction::Pause)
        } else {
            self.state.transition(RuntimeAction::Resume)
        };
        self.refresh_tray_state();
        logging::log_backend(&format!("synced input state: overlay={}, paused={}", self.overlay_active, is_paused));
    }

    pub fn shutdown(&mut self, app: &AppHandle<Wry>) {
        self.state = self.state.transition(RuntimeAction::BeginExit);
        if let Some(tray) = self.tray.take() {
            let _ = tray.icon.set_visible(false);
            drop(tray);
        }
        self.services
            .lifecycle
            .shutdown(app, &self.services.input, &self.services.overlay, &self.services.session);
    }

    fn initialize_tray(&mut self, app: &AppHandle<Wry>) -> Result<(), String> {
        let session_toggle_item = MenuItem::with_id(
            app,
            MENU_SESSION_TOGGLE_ID,
            "Pause Session",
            true,
            None::<&str>,
        )
        .map_err(|error| format!("failed to create Pause/Resume Session menu item: {error}"))?;
        let drawing_mode_toggle_item = MenuItem::with_id(
            app,
            MENU_DRAWING_MODE_TOGGLE_ID,
            "Start Drawing",
            true,
            None::<&str>,
        )
        .map_err(|error| format!("failed to create Draw Mode toggle menu item: {error}"))?;
        let clear_item = MenuItem::with_id(
            app,
            MENU_CLEAR_SESSION_ID,
            "Clear Screen",
            true,
            None::<&str>,
        )
            .map_err(|error| format!("failed to create Clear Screen menu item: {error}"))?;
        let open_settings_item =
            MenuItem::with_id(app, MENU_OPEN_SETTINGS_ID, "Settings", true, None::<&str>)
                .map_err(|error| format!("failed to create Settings menu item: {error}"))?;
        let exit_item = MenuItem::with_id(app, MENU_EXIT_ID, "Exit", true, None::<&str>)
            .map_err(|error| format!("failed to create Exit menu item: {error}"))?;

        let app_title = MenuItem::new(app, "ScreenScribble", false, None::<&str>)
            .map_err(|error| format!("failed to create tray title menu item: {error}"))?;
        let separator_1 = PredefinedMenuItem::separator(app)
            .map_err(|error| format!("failed to create tray separator: {error}"))?;
        let separator_2 = PredefinedMenuItem::separator(app)
            .map_err(|error| format!("failed to create tray separator: {error}"))?;

        let menu = Menu::with_items(
            app,
            &[
                &app_title,
                &separator_1,
                &drawing_mode_toggle_item,
                &session_toggle_item,
                &clear_item,
                &open_settings_item,
                &separator_2,
                &exit_item,
            ],
        )
        .map_err(|error| format!("failed to create tray menu: {error}"))?;

        let mut tray_builder = TrayIconBuilder::with_id("screenscribble-tray")
            .menu(&menu)
            .tooltip("ScreenScribble")
            .show_menu_on_left_click(false)
            .on_menu_event(|app_handle, event| {
                dispatch_tray_menu_event(app_handle, event.id().as_ref());
            });

        if let Some(icon) = app.default_window_icon().cloned() {
            tray_builder = tray_builder.icon(icon);
        }

        let tray_icon = tray_builder
            .build(app)
            .map_err(|error| format!("failed to build tray icon: {error}"))?;

        self.tray = Some(TrayResources {
            icon: tray_icon,
            handles: TrayMenuHandles {
                session_toggle: session_toggle_item,
                drawing_mode_toggle: drawing_mode_toggle_item,
            },
        });

        Ok(())
    }

    fn refresh_tray_state(&mut self) {
        let Some(tray) = &self.tray else {
            return;
        };

        let is_paused = self.state == AppRuntimeState::Paused;
        let overlay_active = self.overlay_active;
        let _ = tray.handles.session_toggle.set_enabled(true);
        let session_toggle_label = if is_paused {
            "Resume"
        } else {
            "Pause"
        };
        let _ = tray.handles.session_toggle.set_text(session_toggle_label);

        let drawing_mode_label = if overlay_active {
            "Stop Drawing"
        } else {
            "Start Drawing"
        };
        let _ = tray.handles.drawing_mode_toggle.set_text(drawing_mode_label);

        let tooltip = match self.state {
            AppRuntimeState::Starting => "ScreenScribble (Starting)",
            AppRuntimeState::Running if !overlay_active => "ScreenScribble (Draw Mode Off)",
            AppRuntimeState::Running => "ScreenScribble (Running)",
            AppRuntimeState::Paused if !overlay_active => "ScreenScribble (Draw Mode Off)",
            AppRuntimeState::Paused => "ScreenScribble (Paused)",
            AppRuntimeState::Exiting => "ScreenScribble (Exiting)",
        };
        let _ = tray.icon.set_tooltip(Some(tooltip));
    }

    fn handle_tray_menu_action(&mut self, app: &AppHandle<Wry>, menu_id: &str) {
        match menu_id {
            MENU_SESSION_TOGGLE_ID => {
                self.toggle_pause_state(app);
            }
            MENU_DRAWING_MODE_TOGGLE_ID => {
                let next_enabled = !self.overlay_active;
                self.set_overlay_active(app, next_enabled);
            }
            MENU_CLEAR_SESSION_ID => self.clear_current_session(app),
            MENU_OPEN_SETTINGS_ID => {
                if let Err(error) = self.open_settings(app) {
                    logging::log_backend(&format!("tray: failed to open settings: {error}"));
                }
            }
            MENU_EXIT_ID => self.shutdown(app),
            _ => {}
        }
    }
}

pub struct AppControllerState {
    controller: Mutex<ApplicationController>,
}

impl AppControllerState {
    pub fn new() -> Self {
        Self {
            controller: Mutex::new(ApplicationController::default()),
        }
    }

    pub fn with_mut<T>(&self, f: impl FnOnce(&mut ApplicationController) -> T) -> T {
        let mut controller = self
            .controller
            .lock()
            .expect("application controller state poisoned");
        f(&mut controller)
    }
}

pub fn dispatch_tray_menu_event(app: &AppHandle<Wry>, menu_id: &str) {
    let state: State<'_, AppControllerState> = app.state();
    state.with_mut(|controller| {
        controller.handle_tray_menu_action(app, menu_id);
    });
}
