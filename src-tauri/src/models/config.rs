use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default)]
    pub app: Option<AppSection>,
    #[serde(default)]
    pub installer: InstallerSection,
    #[serde(default)]
    pub defaults: Option<DefaultsSection>,
    pub sites: Vec<SiteConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSection {
    pub title: Option<String>,
    pub theme: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct InstallerSection {
    //=-- Datto RMM platform subdomain (e.g. "concord", "pinotage", "merlot"). Fills {{platform}}.
    pub platform: Option<String>,

    //=-- Agent download URL template. Supports {{platform}} and {{siteUid}}.
    #[serde(rename = "downloadUrlTemplate")]
    pub download_url_template: Option<String>,

    #[serde(rename = "defaultSavePath")]
    pub default_save_path: Option<String>,

    #[serde(rename = "defaultMode")]
    pub default_mode: Option<AppMode>,

    #[serde(rename = "successExitCodes")]
    pub success_exit_codes: Option<Vec<i32>>,

    pub sha256: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefaultsSection {
    #[serde(rename = "siteId")]
    pub site_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SiteConfig {
    pub id: String,

    #[serde(rename = "shortName")]
    pub short_name: String,

    #[serde(rename = "displayName")]
    pub display_name: String,

    #[serde(rename = "siteUid")]
    pub site_uid: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AppMode {
    Ui,
    Silent,
}

impl AppMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            AppMode::Ui => "ui",
            AppMode::Silent => "silent",
        }
    }
}

impl std::fmt::Display for AppMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}
