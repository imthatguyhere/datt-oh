//! DTOs exchanged with the frontend over Tauri commands (serialized as camelCase).

use serde::{Deserialize, Serialize};

use crate::models::config::SiteConfig;

/// Resolved startup values reported to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupContext {
    /// `"ui"` or `"silent"`.
    pub mode: String,
    /// Whether `/silent` (or `SILENT`) was used.
    pub silent_used: bool,
    /// Config path or URL, if found.
    pub config_source: Option<String>,
    /// Installer URL override, if given.
    pub installer_url: Option<String>,
    /// Save path override, if given.
    pub save_path: Option<String>,
    /// Requested site id, if given.
    pub site_id: Option<String>,
    /// Site UID override, if given.
    pub site_uid: Option<String>,
    /// Platform override, if given.
    pub platform: Option<String>,
    /// Raw extra installer arguments.
    pub extra_args: Vec<String>,
    /// Log file path.
    pub log_path: String,
}

/// Request to plan or run an install for a site.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallRequest {
    /// Id of the site to install for.
    pub site_id: String,
}

/// A validated install plan.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallPlan {
    /// `"ui"` or `"silent"`.
    pub mode: String,
    /// The resolved site.
    pub selected_site: SiteConfig,
    /// Resolved download URL.
    pub installer_url: String,
    /// Resolved destination path.
    pub save_path: String,
    /// Arguments passed to the installer.
    pub installer_args: Vec<String>,
}

/// Outcome of an installer download.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResult {
    /// Where the file was saved.
    pub destination_path: String,
    /// Size in bytes.
    pub file_size: u64,
    /// Download time in milliseconds.
    pub duration_ms: u64,
    /// Whether the download succeeded.
    pub success: bool,
}

/// Outcome of running the installer.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallResult {
    /// Whether the exit code is one of the configured success codes.
    pub success: bool,
    /// Process exit code, if it exited normally.
    pub exit_code: Option<i32>,
    /// Captured standard output.
    pub stdout: String,
    /// Captured standard error.
    pub stderr: String,
    /// Run time in milliseconds.
    pub duration_ms: u64,
    /// Whether the installer asked for a reboot (exit code `3010`).
    pub reboot_required: bool,
}
