//! Startup arguments resolved from the CLI, environment, and `.env`.

use crate::models::config::AppMode;

/// Startup arguments after merging CLI, environment, and `.env` (in that order of precedence).
#[derive(Debug, Clone, Default)]
pub struct StartupArgs {
    /// Requested run mode, if any.
    pub mode: Option<AppMode>,
    /// `/silent` or `SILENT` was given.
    pub silent: bool,
    /// Config path or URL.
    pub config: Option<String>,
    /// Full installer URL, bypassing the template.
    pub installer_url: Option<String>,
    /// Installer save path.
    pub save_path: Option<String>,
    /// Requested site id.
    pub site: Option<String>,
    /// Site UID override.
    pub site_uid: Option<String>,
    /// Datto RMM platform override.
    pub platform: Option<String>,
    /// Raw extra installer arguments.
    pub extra_args: Vec<String>,
    /// Log file path.
    pub log_path: Option<String>,
}
