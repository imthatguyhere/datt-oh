use serde::{Deserialize, Serialize};

use crate::models::config::SiteConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupContext {
    pub mode: String,
    pub silent_used: bool,
    pub config_source: Option<String>,
    pub installer_url: Option<String>,
    pub save_path: Option<String>,
    pub site_id: Option<String>,
    pub site_uid: Option<String>,
    pub platform: Option<String>,
    pub extra_args: Vec<String>,
    pub log_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallRequest {
    pub site_id: String,
    pub selected_arguments: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallPlan {
    pub mode: String,
    pub selected_site: SiteConfig,
    pub installer_url: String,
    pub save_path: String,
    pub installer_args: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResult {
    pub destination_path: String,
    pub file_size: u64,
    pub duration_ms: u64,
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallResult {
    pub success: bool,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
    pub reboot_required: bool,
}
