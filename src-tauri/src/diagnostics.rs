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

pub fn collect_diagnostics() -> ApplicationDiagnostics {
    ApplicationDiagnostics {
        application_version: env!("CARGO_PKG_VERSION").to_string(),
        schema_version: 1,
        operating_system: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        target_os: std::env::consts::OS.to_string(),
    }
}
