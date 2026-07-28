use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationDiagnostics {
    pub application_version: String,
    pub schema_version: i32,
    pub operating_system: String,
    pub arch: String,
    pub target_os: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseMetadata {
    pub app_name: String,
    pub version: String,
    pub build_number: String,
    pub website: String,
    pub support_url: String,
    pub repository_url: String,
    pub license: String,
    pub company: String,
    pub description: String,
    pub copyright: String,
}

pub fn collect_diagnostics() -> ApplicationDiagnostics {
    ApplicationDiagnostics {
        application_version: env!("CARGO_PKG_VERSION").to_string(),
        schema_version: 1,
        operating_system: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        target_os: std::env::consts::OS.to_string(),
    }
}

pub fn collect_release_metadata() -> ReleaseMetadata {
    let build_number = option_env!("SCREENSCRIBBLE_BUILD_NUMBER")
        .or(option_env!("GITHUB_RUN_NUMBER"))
        .unwrap_or("local")
        .to_string();

    ReleaseMetadata {
        app_name: "ScreenScribble".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        build_number,
        website: "https://screenscribble.app".to_string(),
        support_url: "https://github.com/screenscribble/screenscribble/issues".to_string(),
        repository_url: "https://github.com/screenscribble/screenscribble".to_string(),
        license: "MIT".to_string(),
        company: "ScreenScribble".to_string(),
        description: "Transient desktop annotation overlay for demos, meetings, and screenshots.".to_string(),
        copyright: "Copyright (c) 2026 ScreenScribble".to_string(),
    }
}
