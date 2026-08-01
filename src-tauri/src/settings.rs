use std::fs;
use std::path::PathBuf;
use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use crate::shortcut::{KeyBinding};

const SETTINGS_FILE_NAME: &str = "settings.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationSettings {
    #[serde(default = "default_schema_version")]
    pub schema_version: i32,
    pub brush: BrushSettings,
    pub session: SessionSettings,
    pub input: InputSettings,
    pub shortcuts: ShortcutsSettings,
    pub general: GeneralSettings,
}

fn default_schema_version() -> i32 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrushSettings {
    pub colour: String,
    pub width: i32,
    pub opacity: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSettings {
    pub timeout_seconds: i32,
    pub fade_seconds: i32,
    pub reset_timeout_on_new_stroke: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct InputSettings {}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutsSettings {
    #[serde(flatten)]
    pub bindings: HashMap<String, KeyBinding>,
}

impl Default for ShortcutsSettings {
    fn default() -> Self {
        let mut bindings = HashMap::new();
        for (action, binding) in crate::shortcut::ShortcutManager::defaults() {
            bindings.insert(action.to_string().to_string(), binding);
        }
        Self { bindings }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneralSettings {
    pub launch_at_startup: bool,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PartialApplicationSettings {
    schema_version: Option<i32>,
    brush: Option<PartialBrushSettings>,
    session: Option<PartialSessionSettings>,
    shortcuts: Option<PartialShortcutsSettings>,
    general: Option<PartialGeneralSettings>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PartialBrushSettings {
    colour: Option<String>,
    width: Option<i32>,
    opacity: Option<i32>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PartialSessionSettings {
    timeout_seconds: Option<i32>,
    fade_seconds: Option<i32>,
    reset_timeout_on_new_stroke: Option<bool>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PartialShortcutsSettings {
    #[serde(flatten)]
    pub bindings: Option<HashMap<String, KeyBinding>>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PartialGeneralSettings {
    launch_at_startup: Option<bool>,
}

fn default_settings() -> ApplicationSettings {
    ApplicationSettings {
        schema_version: 1,
        brush: BrushSettings {
            colour: "#f43f5e".to_string(),
            width: 5,
            opacity: 95,
        },
        session: SessionSettings {
            timeout_seconds: 10,
            fade_seconds: 1,
            reset_timeout_on_new_stroke: true,
        },
        input: InputSettings::default(),
        shortcuts: ShortcutsSettings::default(),
        general: GeneralSettings {
            launch_at_startup: false,
        },
    }
}

fn clamp_i32(value: i32, min: i32, max: i32) -> i32 {
    value.max(min).min(max)
}

fn normalize_settings(settings: ApplicationSettings) -> ApplicationSettings {
    let defaults = default_settings();
    let schema_version = settings.schema_version.max(1).min(1);

    let colour = if is_hex_colour(&settings.brush.colour) {
        settings.brush.colour
    } else {
        defaults.brush.colour
    };

    let width = clamp_i32(settings.brush.width, 1, 64);
    let opacity = clamp_i32(settings.brush.opacity, 0, 100);

    let timeout_seconds = clamp_i32(settings.session.timeout_seconds, 1, 600);
    let mut fade_seconds = clamp_i32(settings.session.fade_seconds, 0, 600);
    if fade_seconds > timeout_seconds {
        fade_seconds = timeout_seconds;
    }

    ApplicationSettings {
        schema_version,
        brush: BrushSettings {
            colour,
            width,
            opacity,
        },
        session: SessionSettings {
            timeout_seconds,
            fade_seconds,
            reset_timeout_on_new_stroke: settings.session.reset_timeout_on_new_stroke,
        },
        input: InputSettings::default(),
        shortcuts: settings.shortcuts,
        general: GeneralSettings {
            launch_at_startup: settings.general.launch_at_startup,
        },
    }
}

fn merge_partial_settings(partial: PartialApplicationSettings) -> ApplicationSettings {
    let defaults = default_settings();

    let brush_partial = partial.brush.unwrap_or_default();
    let session_partial = partial.session.unwrap_or_default();
    let shortcuts_partial = partial.shortcuts.unwrap_or_default();
    let general_partial = partial.general.unwrap_or_default();

    // Merge shortcuts: use provided bindings or fall back to defaults
    let shortcuts_bindings = if let Some(bindings) = shortcuts_partial.bindings {
        bindings
    } else {
        defaults.shortcuts.bindings.clone()
    };

    normalize_settings(ApplicationSettings {
        schema_version: partial.schema_version.unwrap_or(1),
        brush: BrushSettings {
            colour: brush_partial.colour.unwrap_or(defaults.brush.colour),
            width: brush_partial.width.unwrap_or(defaults.brush.width),
            opacity: brush_partial.opacity.unwrap_or(defaults.brush.opacity),
        },
        session: SessionSettings {
            timeout_seconds: session_partial
                .timeout_seconds
                .unwrap_or(defaults.session.timeout_seconds),
            fade_seconds: session_partial.fade_seconds.unwrap_or(defaults.session.fade_seconds),
            reset_timeout_on_new_stroke: session_partial
                .reset_timeout_on_new_stroke
                .unwrap_or(defaults.session.reset_timeout_on_new_stroke),
        },
        input: InputSettings::default(),
        shortcuts: ShortcutsSettings {
            bindings: shortcuts_bindings,
        },
        general: GeneralSettings {
            launch_at_startup: general_partial
                .launch_at_startup
                .unwrap_or(defaults.general.launch_at_startup),
        },
    })
}

fn is_hex_colour(input: &str) -> bool {
    if input.len() != 7 || !input.starts_with('#') {
        return false;
    }

    input
        .chars()
        .skip(1)
        .all(|char| char.is_ascii_hexdigit())
}

pub fn settings_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut config_dir = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("failed to resolve app config directory: {error}"))?;
    config_dir.push(SETTINGS_FILE_NAME);
    Ok(config_dir)
}

fn write_settings_atomic(path: &PathBuf, settings: &ApplicationSettings) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create config directory '{}': {error}", parent.display()))?;
    }

    let serialized = serde_json::to_string_pretty(settings)
        .map_err(|error| format!("failed to serialize settings: {error}"))?;

    let mut temporary_path = path.clone();
    temporary_path.set_extension("json.tmp");

    fs::write(&temporary_path, serialized)
        .map_err(|error| format!("failed to write temporary settings file '{}': {error}", temporary_path.display()))?;

    if path.exists() {
        fs::remove_file(path)
            .map_err(|error| format!("failed to replace existing settings file '{}': {error}", path.display()))?;
    }

    fs::rename(&temporary_path, path).map_err(|error| {
        format!(
            "failed to move temporary settings file '{}' to '{}': {error}",
            temporary_path.display(),
            path.display()
        )
    })
}

pub fn load_settings(app: &AppHandle) -> ApplicationSettings {
    let path = match settings_file_path(app) {
        Ok(path) => path,
        Err(error) => {
            crate::logging::log_backend(&format!("settings path resolution failed: {error}"));
            return default_settings();
        }
    };

    if !path.exists() {
        let defaults = default_settings();
        if let Err(error) = write_settings_atomic(&path, &defaults) {
            crate::logging::log_backend(&format!("failed to create default settings file: {error}"));
        }
        return defaults;
    }

    let raw = match fs::read_to_string(&path) {
        Ok(content) => content,
        Err(error) => {
            crate::logging::log_backend(&format!("failed to read settings file '{}': {error}", path.display()));
            return default_settings();
        }
    };

    let partial = match serde_json::from_str::<PartialApplicationSettings>(&raw) {
        Ok(partial) => partial,
        Err(error) => {
            crate::logging::log_backend(&format!(
                "failed to parse settings file '{}': {error}; falling back to defaults",
                path.display()
            ));
            return default_settings();
        }
    };

    let merged = merge_partial_settings(partial);
    if let Err(error) = write_settings_atomic(&path, &merged) {
        crate::logging::log_backend(&format!("failed to migrate settings file '{}': {error}", path.display()));
    }

    merged
}

pub fn save_settings(app: &AppHandle, settings: ApplicationSettings) -> ApplicationSettings {
    let normalized = normalize_settings(settings);

    match settings_file_path(app) {
        Ok(path) => {
            if let Err(error) = write_settings_atomic(&path, &normalized) {
                crate::logging::log_backend(&format!("failed to save settings file '{}': {error}", path.display()));
            }
        }
        Err(error) => {
            crate::logging::log_backend(&format!("settings path resolution failed while saving: {error}"));
        }
    }

    normalized
}

pub fn emit_settings_updated(app: &AppHandle, settings: &ApplicationSettings) {
    for label in ["main", "overlay", "settings"] {
        if let Some(window) = app.get_webview_window(label) {
            let _ = window.emit("screen_scribble:settings-updated", settings.clone());
        }
    }
}
