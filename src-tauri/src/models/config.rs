//! Shape of the JSON config file (camelCase keys) and the run mode.

use serde::{Deserialize, Serialize};

/// The full JSON config.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// Branding (`app` section).
    #[serde(default)]
    pub app: Option<AppSection>,
    /// Installer settings (`installer` section).
    #[serde(default)]
    pub installer: InstallerSection,
    /// Defaults (`defaults` section).
    #[serde(default)]
    pub defaults: Option<DefaultsSection>,
    /// Customer sites the agent can be installed for.
    pub sites: Vec<SiteConfig>,
}

/// Branding shown in the UI (`app` section).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSection {
    /// Window and header title.
    pub title: Option<String>,
    /// Line shown under the title in the header.
    pub subtitle: Option<String>,
    /// daisyUI theme name. Parsed but not currently used (the theme is set in `index.html`).
    pub theme: Option<String>,
}

/// Installer settings (`installer` section).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct InstallerSection {
    /// Datto RMM platform subdomain (e.g. `concord`); fills `{{platform}}` in the template.
    pub platform: Option<String>,

    /// Agent download URL template; supports `{{platform}}` and `{{siteUid}}`.
    #[serde(rename = "downloadUrlTemplate")]
    pub download_url_template: Option<String>,

    /// Where the installer is saved.
    #[serde(rename = "defaultSavePath")]
    pub default_save_path: Option<String>,

    /// Intended default run mode. Parsed but not currently used; mode comes from `/mode`, `/silent`,
    /// `MODE` and `SILENT`.
    #[serde(rename = "defaultMode")]
    pub default_mode: Option<AppMode>,

    /// Exit codes treated as success (default `0` and `3010`).
    #[serde(rename = "successExitCodes")]
    pub success_exit_codes: Option<Vec<i32>>,

    /// Intended expected SHA-256 of the installer. Parsed but not currently verified.
    pub sha256: Option<String>,
}

/// Defaults used when nothing else is specified (`defaults` section).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefaultsSection {
    /// Site id pre-selected in the UI, and used by silent mode when `/site` is omitted.
    #[serde(rename = "siteId")]
    pub site_id: Option<String>,
}

/// A customer site the agent can be installed for.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SiteConfig {
    /// Unique id (case-insensitive) used by `/site` and `defaults.siteId`.
    pub id: String,

    /// Short name shown first in the dropdown.
    #[serde(rename = "shortName")]
    pub short_name: String,

    /// Full customer/site name.
    #[serde(rename = "displayName")]
    pub display_name: String,

    /// Datto RMM site UID (letters, digits and `-`); placed in the download URL.
    #[serde(rename = "siteUid")]
    pub site_uid: String,
}

/// How the app runs: with a window (`ui`) or headless (`silent`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AppMode {
    /// Show the window.
    Ui,
    /// Run headless: no window, log to file, exit with a code.
    Silent,
}

/// Helpers for [`AppMode`].
impl AppMode {
    /// Returns the lowercase mode name.
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
