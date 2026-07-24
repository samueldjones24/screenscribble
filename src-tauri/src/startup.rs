use tauri::AppHandle;

#[cfg(windows)]
mod windows_impl {
    use super::AppHandle;
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_WRITE};
    use winreg::RegKey;

    const RUN_KEY_PATH: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    const RUN_VALUE_NAME: &str = "ScreenScribble";

    fn executable_value(app: &AppHandle) -> Result<String, String> {
        let _ = app;
        let executable_path = std::env::current_exe()
            .map_err(|error| format!("failed to resolve executable path: {error}"))?;
        Ok(format!("\"{}\"", executable_path.display()))
    }

    pub fn apply_launch_at_startup(app: &AppHandle, enabled: bool) -> Result<(), String> {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let run_key = hkcu
            .open_subkey_with_flags(RUN_KEY_PATH, KEY_READ | KEY_WRITE)
            .map_err(|error| format!("failed to open startup registry key: {error}"))?;

        if enabled {
            let value = executable_value(app)?;
            run_key
                .set_value(RUN_VALUE_NAME, &value)
                .map_err(|error| format!("failed to enable launch at startup: {error}"))?;
            return Ok(());
        }

        match run_key.delete_value(RUN_VALUE_NAME) {
            Ok(_) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(format!("failed to disable launch at startup: {error}")),
        }
    }
}

#[cfg(not(windows))]
mod windows_impl {
    use super::AppHandle;

    pub fn apply_launch_at_startup(_app: &AppHandle, _enabled: bool) -> Result<(), String> {
        Ok(())
    }
}

pub fn apply_launch_at_startup(app: &AppHandle, enabled: bool) -> Result<(), String> {
    windows_impl::apply_launch_at_startup(app, enabled)
}
