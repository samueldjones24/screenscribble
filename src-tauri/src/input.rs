use std::sync::{mpsc, OnceLock};

use serde::Serialize;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize)]
pub struct MouseHookEvent {
    pub kind: String,
    pub x: i32,
    pub y: i32,
    pub button: i32,
    pub ctrl: bool,
    pub alt: bool,
    pub shift: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct SafetyHotkeyEvent {
    pub kind: String,
    pub enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct InputDiagnosticEvent {
    pub stage: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
struct SessionControlHotkeyEvent {
    kind: String,
}

enum HookEvent {
    Mouse(MouseHookEvent),
    Safety(SafetyHotkeyEvent),
}

static EVENT_SENDER: OnceLock<mpsc::Sender<HookEvent>> = OnceLock::new();

#[cfg(windows)]
mod windows_impl {
    use super::{
        HookEvent, InputDiagnosticEvent, MouseHookEvent, SafetyHotkeyEvent,
        SessionControlHotkeyEvent, EVENT_SENDER,
    };
    use crate::shortcut::{ShortcutManager, KeyBinding, ShortcutAction};
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::mpsc;
    use std::sync::{Mutex, OnceLock};
    use std::collections::HashMap;
    use tauri::{AppHandle, Emitter, Manager};
    use windows::Win32::Foundation::{LPARAM, LRESULT, POINT, WPARAM};
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, VK_CONTROL, VK_LCONTROL, VK_MENU,
        VK_RCONTROL, VK_SHIFT,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, GetClassNameW, SetWindowsHookExW, UnhookWindowsHookEx, WindowFromPoint,
        HC_ACTION, HHOOK, KBDLLHOOKSTRUCT, MSLLHOOKSTRUCT, WH_KEYBOARD_LL, WH_MOUSE_LL, WM_KEYDOWN,
        WM_KEYUP, WM_LBUTTONDOWN, WM_LBUTTONUP, WM_MOUSEMOVE, WM_SYSKEYDOWN, WM_SYSKEYUP,
    };

    struct HookState {
        mouse: Option<HHOOK>,
        keyboard: Option<HHOOK>,
    }

    unsafe impl Send for HookState {}
    unsafe impl Sync for HookState {}

    static HOOK_STATE: OnceLock<Mutex<HookState>> = OnceLock::new();
    static SHORTCUT_MANAGER: OnceLock<ShortcutManager> = OnceLock::new();
    static OVERLAY_ACTIVE: AtomicBool = AtomicBool::new(false);
    static DRAWING_PAUSED: AtomicBool = AtomicBool::new(false);
    static SUPPRESS_UNDERLYING_MOUSE: AtomicBool = AtomicBool::new(false);
    static DRAW_MODE_TOGGLE_LATCH: AtomicBool = AtomicBool::new(false);
    static PAUSE_RESUME_LATCH: AtomicBool = AtomicBool::new(false);
    static CLEAR_DRAWING_LATCH: AtomicBool = AtomicBool::new(false);
    static CTRL_KEY_DOWN: AtomicBool = AtomicBool::new(false);
    static ALT_KEY_DOWN: AtomicBool = AtomicBool::new(false);
    static DEBUG_MOUSE_DIAGNOSTICS_ENABLED: AtomicBool = AtomicBool::new(false);

    fn is_ctrl_vk(virtual_key: u32) -> bool {
        virtual_key == VK_CONTROL.0 as u32
            || virtual_key == VK_LCONTROL.0 as u32
            || virtual_key == VK_RCONTROL.0 as u32
    }

    fn is_alt_vk(virtual_key: u32) -> bool {
        virtual_key == VK_MENU.0 as u32
    }
    #[allow(dead_code)]    fn is_key_down(virtual_key: i32) -> bool {
        unsafe { (GetAsyncKeyState(virtual_key) as u16 & 0x8000) != 0 }
    }

    fn current_modifier_state() -> (bool, bool, bool) {
        (
            is_key_down(VK_CONTROL.0 as i32),
            is_key_down(VK_MENU.0 as i32),
            is_key_down(VK_SHIFT.0 as i32),
        )
    }

    fn is_shell_ui_point(x: i32, y: i32) -> bool {
        let point = POINT { x, y };
        let hwnd = unsafe { WindowFromPoint(point) };
        if hwnd.0.is_null() {
            return false;
        }

        let mut class_name = [0u16; 256];
        let len = unsafe { GetClassNameW(hwnd, &mut class_name) };
        if len <= 0 {
            return false;
        }

        let class_name = String::from_utf16_lossy(&class_name[..len as usize]);
        matches!(
            class_name.as_str(),
            "Shell_TrayWnd"
                | "Shell_SecondaryTrayWnd"
                | "TrayNotifyWnd"
                | "NotifyIconOverflowWindow"
                | "#32768"
        )
    }

    fn set_overlay_clickthrough(app_handle: &AppHandle, ignore_cursor: bool) {
        if let Some(window) = app_handle.get_webview_window("overlay") {
            // Toggle click-through so the overlay can expose cursor styling while drawing.
            let _ = window.set_ignore_cursor_events(ignore_cursor);
        }
    }

    fn emit_overlay_state(app_handle: &AppHandle, enabled: bool) {
        let event = SafetyHotkeyEvent {
            kind: "toggle_overlay".to_string(),
            enabled: Some(enabled),
        };

        emit_safety_event(app_handle, event);
    }

    fn emit_pause_state(app_handle: &AppHandle, enabled: bool) {
        let event = SafetyHotkeyEvent {
            kind: "pause_drawing".to_string(),
            enabled: Some(enabled),
        };

        emit_safety_event(app_handle, event);
    }

    fn emit_safety_event(app_handle: &AppHandle, event: SafetyHotkeyEvent) {
        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.emit("screen_scribble:safety", event.clone());
        }

        if let Some(window) = app_handle.get_webview_window("overlay") {
            let _ = window.emit("screen_scribble:safety", event);
        }
    }

    fn emit_diagnostic(app_handle: &AppHandle, stage: &str, message: &str) {
        if stage == "mouse-event" && !DEBUG_MOUSE_DIAGNOSTICS_ENABLED.load(Ordering::Relaxed) {
            return;
        }

        #[cfg(not(debug_assertions))]
        {
            let _ = (app_handle, stage, message);
            return;
        }

        let event = InputDiagnosticEvent {
            stage: stage.to_string(),
            message: message.to_string(),
        };

        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.emit("screen_scribble:diagnostic", event.clone());
        }

        if let Some(window) = app_handle.get_webview_window("overlay") {
            let _ = window.emit("screen_scribble:diagnostic", event);
        }
    }

    fn update_overlay_active(app_handle: &AppHandle, enabled: bool) {
        OVERLAY_ACTIVE.store(enabled, Ordering::Relaxed);
        if enabled {
            DRAWING_PAUSED.store(false, Ordering::Relaxed);
        }
        SUPPRESS_UNDERLYING_MOUSE.store(false, Ordering::Relaxed);
        DRAW_MODE_TOGGLE_LATCH.store(false, Ordering::Relaxed);
        set_overlay_clickthrough(app_handle, true);
        emit_overlay_state(app_handle, enabled);
    }

    unsafe extern "system" fn mouse_hook_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if code >= HC_ACTION as i32 {
            let message = wparam.0 as u32;
            let hook_data = *(lparam.0 as *const MSLLHOOKSTRUCT);
            let is_shell_ui = is_shell_ui_point(hook_data.pt.x, hook_data.pt.y);

            if let Some(sender) = EVENT_SENDER.get() {
                let (ctrl, alt, shift) = current_modifier_state();
                let event = if is_shell_ui {
                    // Allow shell UI interaction, but still flush pointer-up when a drawing drag
                    // ends over tray/taskbar so frontend/native state does not get stuck.
                    if message == WM_LBUTTONUP && SUPPRESS_UNDERLYING_MOUSE.load(Ordering::Relaxed) {
                        Some(MouseHookEvent {
                            kind: "up".to_string(),
                            x: hook_data.pt.x,
                            y: hook_data.pt.y,
                            button: 0,
                            ctrl,
                            alt,
                            shift,
                        })
                    } else {
                        None
                    }
                } else {
                    match message {
                        WM_MOUSEMOVE => Some(MouseHookEvent {
                            kind: "move".to_string(),
                            x: hook_data.pt.x,
                            y: hook_data.pt.y,
                            button: 0,
                            ctrl,
                            alt,
                            shift,
                        }),
                        WM_LBUTTONDOWN => Some(MouseHookEvent {
                            kind: "down".to_string(),
                            x: hook_data.pt.x,
                            y: hook_data.pt.y,
                            button: 0,
                            ctrl,
                            alt,
                            shift,
                        }),
                        WM_LBUTTONUP => Some(MouseHookEvent {
                            kind: "up".to_string(),
                            x: hook_data.pt.x,
                            y: hook_data.pt.y,
                            button: 0,
                            ctrl,
                            alt,
                            shift,
                        }),
                        _ => None,
                    }
                };

                if let Some(mouse_event) = event {
                    let _ = sender.send(HookEvent::Mouse(mouse_event));
                }

                if OVERLAY_ACTIVE.load(Ordering::Relaxed) && !DRAWING_PAUSED.load(Ordering::Relaxed) {
                    if is_shell_ui {
                        SUPPRESS_UNDERLYING_MOUSE.store(false, Ordering::Relaxed);
                        return CallNextHookEx(HHOOK(std::ptr::null_mut()), code, wparam, lparam);
                    }

                    let draw_start = message == WM_LBUTTONDOWN;
                    if draw_start {
                        SUPPRESS_UNDERLYING_MOUSE.store(true, Ordering::Relaxed);
                    }

                    let is_suppressed = SUPPRESS_UNDERLYING_MOUSE.load(Ordering::Relaxed);
                    let should_suppress = draw_start
                        || (is_suppressed
                            && (message == WM_LBUTTONDOWN
                                || message == WM_LBUTTONUP));

                    if message == WM_LBUTTONUP {
                        SUPPRESS_UNDERLYING_MOUSE.store(false, Ordering::Relaxed);
                    }

                    if should_suppress {
                        return LRESULT(1);
                    }
                } else {
                    SUPPRESS_UNDERLYING_MOUSE.store(false, Ordering::Relaxed);
                }
            }
        }

        CallNextHookEx(HHOOK(std::ptr::null_mut()), code, wparam, lparam)
    }

    fn vk_to_char(virtual_key: u32) -> Option<String> {
        // Convert common virtual key codes to their character representation
        // For letters (A-Z): VK_A = 0x41, VK_Z = 0x5A
        // For digits (0-9): VK_0 = 0x30, VK_9 = 0x39
        if (0x41..=0x5A).contains(&virtual_key) {
            // A-Z
            Some((virtual_key as u8 as char).to_string())
        } else if (0x30..=0x39).contains(&virtual_key) {
            // 0-9
            Some((virtual_key as u8 as char).to_string())
        } else {
            None
        }
    }

    unsafe extern "system" fn keyboard_hook_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if code >= HC_ACTION as i32 {
            if let Some(sender) = EVENT_SENDER.get() {
                let hook_data = *(lparam.0 as *const KBDLLHOOKSTRUCT);
                let is_key_down_message = wparam.0 as u32 == WM_KEYDOWN || wparam.0 as u32 == WM_SYSKEYDOWN;
                let is_key_up_message = wparam.0 as u32 == WM_KEYUP || wparam.0 as u32 == WM_SYSKEYUP;
                let virtual_key = hook_data.vkCode;

                if is_key_down_message && is_ctrl_vk(virtual_key) {
                    CTRL_KEY_DOWN.store(true, Ordering::Relaxed);
                }

                if is_key_down_message && is_alt_vk(virtual_key) {
                    ALT_KEY_DOWN.store(true, Ordering::Relaxed);
                }

                if is_key_up_message && is_ctrl_vk(virtual_key) {
                    CTRL_KEY_DOWN.store(false, Ordering::Relaxed);
                }

                if is_key_up_message && is_alt_vk(virtual_key) {
                    ALT_KEY_DOWN.store(false, Ordering::Relaxed);
                }

                if is_key_up_message && (is_ctrl_vk(virtual_key) || is_alt_vk(virtual_key)) {
                    // Reset latches when modifier keys are released
                    DRAW_MODE_TOGGLE_LATCH.store(false, Ordering::Relaxed);
                    PAUSE_RESUME_LATCH.store(false, Ordering::Relaxed);
                    CLEAR_DRAWING_LATCH.store(false, Ordering::Relaxed);
                }

                // Check if any registered shortcut matches the current key press
                if is_key_down_message {
                    let ctrl_down = CTRL_KEY_DOWN.load(Ordering::Relaxed) || is_key_down(VK_CONTROL.0 as i32);
                    let alt_down = ALT_KEY_DOWN.load(Ordering::Relaxed) || is_key_down(VK_MENU.0 as i32);
                    let shift_down = is_key_down(VK_SHIFT.0 as i32);

                    if let Some(manager) = SHORTCUT_MANAGER.get() {
                        // Try to match against registered shortcuts
                        // Convert virtual key code to character string
                        if let Some(key_char) = vk_to_char(virtual_key) {
                            if let Some(action) = manager.get_action(ctrl_down, alt_down, shift_down, &key_char) {
                                let should_trigger = match action {
                                    ShortcutAction::DrawModeToggle => {
                                        !DRAW_MODE_TOGGLE_LATCH.load(Ordering::Relaxed)
                                    }
                                    ShortcutAction::PauseResume => !PAUSE_RESUME_LATCH.load(Ordering::Relaxed),
                                    ShortcutAction::ClearDrawing => !CLEAR_DRAWING_LATCH.load(Ordering::Relaxed),
                                };

                                if should_trigger {
                                    match action {
                                        ShortcutAction::DrawModeToggle => {
                                            DRAW_MODE_TOGGLE_LATCH.store(true, Ordering::Relaxed);
                                            let _ = sender.send(HookEvent::Safety(SafetyHotkeyEvent {
                                                kind: "toggle_overlay".to_string(),
                                                enabled: None,
                                            }));
                                        }
                                        ShortcutAction::PauseResume => {
                                            PAUSE_RESUME_LATCH.store(true, Ordering::Relaxed);
                                            let _ = sender.send(HookEvent::Safety(SafetyHotkeyEvent {
                                                kind: "pause_drawing".to_string(),
                                                enabled: None,
                                            }));
                                        }
                                        ShortcutAction::ClearDrawing => {
                                            CLEAR_DRAWING_LATCH.store(true, Ordering::Relaxed);
                                            let _ = sender.send(HookEvent::Safety(SafetyHotkeyEvent {
                                                kind: "clear_session".to_string(),
                                                enabled: None,
                                            }));
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

            }
        }

        CallNextHookEx(HHOOK(std::ptr::null_mut()), code, wparam, lparam)
    }

    pub fn install(app: &AppHandle) -> Result<(), String> {
        let hook_state = HOOK_STATE.get_or_init(|| {
            Mutex::new(HookState {
                mouse: None,
                keyboard: None,
            })
        });

        if let Ok(guard) = hook_state.lock() {
            if guard.mouse.is_some() && guard.keyboard.is_some() {
                return Ok(());
            }
        }

        if EVENT_SENDER.get().is_none() {
            let (sender, receiver) = mpsc::channel();
            let _ = EVENT_SENDER.set(sender);

            let event_thread_handle = app.clone();

            std::thread::spawn(move || {
                while let Ok(event) = receiver.recv() {
                    match event {
                        HookEvent::Mouse(mouse_event) => {
                            if OVERLAY_ACTIVE.load(Ordering::Relaxed) && !DRAWING_PAUSED.load(Ordering::Relaxed) {
                                // Only left-click (button 0) triggers drawing when overlay is active
                                if mouse_event.kind == "down" && mouse_event.button == 0 {
                                    set_overlay_clickthrough(&event_thread_handle, false);
                                }

                                if mouse_event.kind == "up" && mouse_event.button == 0 {
                                    set_overlay_clickthrough(&event_thread_handle, true);
                                }

                                emit_diagnostic(
                                    &event_thread_handle,
                                    "mouse-event",
                                    &format!(
                                        "kind={} button={} x={} y={}",
                                        mouse_event.kind, mouse_event.button, mouse_event.x, mouse_event.y
                                    ),
                                );

                                if let Some(window) = event_thread_handle.get_webview_window("overlay") {
                                    let _ = window.emit("screen_scribble:input", mouse_event.clone());
                                } else {
                                    emit_diagnostic(&event_thread_handle, "emit-failure", "overlay window not found while emitting input");
                                }
                            }
                        }
                        HookEvent::Safety(safety_event) => match safety_event.kind.as_str() {
                            "toggle_overlay" => {
                                let next_enabled = !OVERLAY_ACTIVE.load(Ordering::Relaxed);
                                emit_diagnostic(
                                    &event_thread_handle,
                                    "safety",
                                    &format!("toggle_overlay -> enabled={next_enabled}"),
                                );
                                update_overlay_active(&event_thread_handle, next_enabled);
                            }
                            "clear_session" => {
                                emit_diagnostic(&event_thread_handle, "safety", "clear_session hotkey");
                                SUPPRESS_UNDERLYING_MOUSE.store(false, Ordering::Relaxed);
                                set_overlay_clickthrough(&event_thread_handle, true);
                                let payload = SessionControlHotkeyEvent {
                                    kind: "clear_current_session".to_string(),
                                };

                                if let Some(window) = event_thread_handle.get_webview_window("overlay") {
                                    let _ = window.emit("screen_scribble:session-control", payload);
                                }
                            }
                            _ => {
                                if let Some(window) = event_thread_handle.get_webview_window("main") {
                                    let _ = window.emit("screen_scribble:safety", safety_event.clone());
                                }
                                if let Some(window) = event_thread_handle.get_webview_window("overlay") {
                                    let _ = window.emit("screen_scribble:safety", safety_event);
                                }
                            }
                        },
                    }
                }
            });
        }

        let app_handle = app.clone();
        set_overlay_clickthrough(&app_handle, true);
        emit_diagnostic(&app_handle, "install", "global input hooks installed");

        let module_handle = unsafe {
            GetModuleHandleW(None).map_err(|error| format!("failed to resolve module handle: {error}"))?
        };

        let mouse_hook = unsafe {
            SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_hook_proc), module_handle, 0)
                .map_err(|error| format!("failed to install global mouse hook: {error}"))?
        };

        let keyboard_hook = unsafe {
            SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_hook_proc), module_handle, 0)
                .map_err(|error| format!("failed to install global keyboard hook: {error}"))?
        };

        emit_diagnostic(
            &app_handle,
            "install",
            &format!("mouse_hook_valid={} keyboard_hook_valid={}", !mouse_hook.is_invalid(), !keyboard_hook.is_invalid()),
        );

        if let Ok(mut guard) = hook_state.lock() {
            guard.mouse = Some(mouse_hook);
            guard.keyboard = Some(keyboard_hook);
        }

        Ok(())
    }

    pub fn uninstall() {
        if let Some(state) = HOOK_STATE.get() {
            if let Ok(mut guard) = state.lock() {
                if let Some(mouse_hook) = guard.mouse.take() {
                    let _ = unsafe { UnhookWindowsHookEx(mouse_hook) };
                }
                if let Some(keyboard_hook) = guard.keyboard.take() {
                    let _ = unsafe { UnhookWindowsHookEx(keyboard_hook) };
                }
            }
        }
    }

    pub fn set_pause_state(app: &AppHandle, paused: bool) {
        DRAWING_PAUSED.store(paused, Ordering::Relaxed);
        SUPPRESS_UNDERLYING_MOUSE.store(false, Ordering::Relaxed);
        PAUSE_RESUME_LATCH.store(false, Ordering::Relaxed);
        set_overlay_clickthrough(app, true);
        emit_pause_state(app, !paused);
    }

    pub fn is_overlay_enabled() -> bool {
        OVERLAY_ACTIVE.load(Ordering::Relaxed)
    }

    pub fn is_drawing_paused() -> bool {
        DRAWING_PAUSED.load(Ordering::Relaxed)
    }

    pub fn set_overlay_active(app: &AppHandle, enabled: bool) {
        update_overlay_active(app, enabled);
    }

    pub fn set_overlay_clickthrough_state(app: &AppHandle, ignore_cursor: bool) {
        set_overlay_clickthrough(app, ignore_cursor);
    }

    pub fn initialize_shortcuts(bindings: HashMap<ShortcutAction, KeyBinding>) {
        let manager = ShortcutManager::new(bindings);
        let _ = SHORTCUT_MANAGER.set(manager);
    }

}

#[cfg(not(windows))]
mod windows_impl {
    use tauri::AppHandle;
    use std::collections::HashMap;
    use crate::shortcut::{ShortcutAction, KeyBinding};

    pub fn install(_app: &AppHandle) -> Result<(), String> {
        Ok(())
    }

    pub fn uninstall() {}

    pub fn is_overlay_enabled() -> bool {
        true
    }

    pub fn is_drawing_paused() -> bool {
        false
    }

    pub fn set_overlay_active(_app: &AppHandle, _enabled: bool) {}

    pub fn set_overlay_clickthrough_state(_app: &AppHandle, _ignore_cursor: bool) {}

    pub fn initialize_shortcuts(_bindings: HashMap<ShortcutAction, KeyBinding>) {}

}

pub fn install_global_mouse_hook(app: &AppHandle) -> Result<(), String> {
    windows_impl::install(app)
}

pub fn uninstall_global_mouse_hook() {
    windows_impl::uninstall();
}

pub fn set_pause_state(app: &AppHandle, paused: bool) {
    windows_impl::set_pause_state(app, paused);
}

pub fn is_overlay_enabled() -> bool {
    windows_impl::is_overlay_enabled()
}

pub fn is_drawing_paused() -> bool {
    windows_impl::is_drawing_paused()
}

pub fn set_overlay_active(app: &AppHandle, enabled: bool) {
    windows_impl::set_overlay_active(app, enabled);
}

pub fn set_overlay_clickthrough_state(app: &AppHandle, ignore_cursor: bool) {
    windows_impl::set_overlay_clickthrough_state(app, ignore_cursor);
}

pub fn initialize_shortcuts(bindings: std::collections::HashMap<crate::shortcut::ShortcutAction, crate::shortcut::KeyBinding>) {
    windows_impl::initialize_shortcuts(bindings);
}

