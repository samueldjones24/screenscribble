use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ShortcutAction {
    #[serde(rename = "draw_mode_toggle")]
    DrawModeToggle,
    #[serde(rename = "pause_resume")]
    PauseResume,
    #[serde(rename = "clear_drawing")]
    ClearDrawing,
}

impl ShortcutAction {
    pub fn to_string(&self) -> &'static str {
        match self {
            Self::DrawModeToggle => "draw_mode_toggle",
            Self::PauseResume => "pause_resume",
            Self::ClearDrawing => "clear_drawing",
        }
    }

    #[allow(dead_code)]
    pub fn from_string(s: &str) -> Option<Self> {
        match s {
            "draw_mode_toggle" => Some(Self::DrawModeToggle),
            "pause_resume" => Some(Self::PauseResume),
            "clear_drawing" => Some(Self::ClearDrawing),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyBinding {
    pub ctrl: bool,
    pub alt: bool,
    pub shift: bool,
    pub key: String, // e.g., "D", "C", "P"
}

impl KeyBinding {
    pub fn new(ctrl: bool, alt: bool, shift: bool, key: &str) -> Self {
        Self {
            ctrl,
            alt,
            shift,
            key: key.to_uppercase(),
        }
    }

    #[allow(dead_code)]
    pub fn to_string(&self) -> String {
        let mut parts = Vec::new();
        if self.ctrl {
            parts.push("Ctrl");
        }
        if self.alt {
            parts.push("Alt");
        }
        if self.shift {
            parts.push("Shift");
        }
        parts.push(&self.key);
        parts.join(" + ")
    }

    pub fn matches(&self, ctrl: bool, alt: bool, shift: bool, key: &str) -> bool {
        self.ctrl == ctrl && self.alt == alt && self.shift == shift && self.key.eq_ignore_ascii_case(key)
    }
}

pub struct ShortcutManager {
    bindings: HashMap<ShortcutAction, KeyBinding>,
}

impl ShortcutManager {
    pub fn new(bindings: HashMap<ShortcutAction, KeyBinding>) -> Self {
        Self { bindings }
    }

    pub fn defaults() -> HashMap<ShortcutAction, KeyBinding> {
        let mut defaults = HashMap::new();
        defaults.insert(
            ShortcutAction::DrawModeToggle,
            KeyBinding::new(true, true, false, "D"),
        );
        defaults.insert(
            ShortcutAction::PauseResume,
            KeyBinding::new(true, true, false, "P"),
        );
        defaults.insert(
            ShortcutAction::ClearDrawing,
            KeyBinding::new(true, true, false, "C"),
        );
        defaults
    }

    #[allow(dead_code)]
    pub fn get_binding(&self, action: ShortcutAction) -> Option<&KeyBinding> {
        self.bindings.get(&action)
    }

    pub fn get_action(&self, ctrl: bool, alt: bool, shift: bool, key: &str) -> Option<ShortcutAction> {
        for (action, binding) in &self.bindings {
            if binding.matches(ctrl, alt, shift, key) {
                return Some(*action);
            }
        }
        None
    }

    #[allow(dead_code)]
    pub fn update_binding(&mut self, action: ShortcutAction, binding: KeyBinding) {
        self.bindings.insert(action, binding);
    }

    #[allow(dead_code)]
    pub fn get_all_bindings(&self) -> &HashMap<ShortcutAction, KeyBinding> {
        &self.bindings
    }

    #[allow(dead_code)]
    pub fn execute<R: tauri::Runtime>(
        &self,
        action: ShortcutAction,
        app: &AppHandle<R>,
    ) {
        match action {
            ShortcutAction::DrawModeToggle => {
                let _ = app.emit("screen_scribble:trigger_toggle_overlay", ());
            }
            ShortcutAction::PauseResume => {
                let _ = app.emit("screen_scribble:trigger_pause_resume", ());
            }
            ShortcutAction::ClearDrawing => {
                let _ = app.emit("screen_scribble:trigger_clear_drawing", ());
            }
        }
    }
}
