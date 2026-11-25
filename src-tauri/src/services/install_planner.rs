//! Builds the install plan: resolves the site and expands the per-site download URL.

use crate::models::config::{AppConfig, SiteConfig};
use crate::models::errors::AppError;
use crate::models::installer::InstallPlan;

/// Datto RMM agent download URL used when the config has no `downloadUrlTemplate`.
pub const DEFAULT_DOWNLOAD_URL_TEMPLATE: &str =
    "https://{{platform}}.rmm.datto.com/download-agent/windows/{{siteUid}}";

/// Inputs for [`build_install_plan`].
pub struct InstallPlanInput<'a> {
    /// Id of the site to install for (case-insensitive).
    pub site_id: &'a str,
    /// Overrides the site UID from the config.
    pub site_uid_override: Option<&'a str>,
    /// Overrides `installer.platform`.
    pub platform_override: Option<&'a str>,
    /// Full download URL; skips the template entirely.
    pub installer_url_override: Option<&'a str>,
    /// Overrides `installer.defaultSavePath`.
    pub save_path_override: Option<&'a str>,
    /// Raw extra installer arguments from the CLI or environment.
    pub extra_args: &'a [String],
    /// Whether this is a silent-mode run (reported in the plan).
    pub silent: bool,
}

/// Builds the download URL, save path, and installer arguments for the chosen site.
pub fn build_install_plan(
    config: &AppConfig,
    input: &InstallPlanInput<'_>,
) -> Result<InstallPlan, AppError> {
    let site = config
        .sites
        .iter()
        .find(|s| s.id.eq_ignore_ascii_case(input.site_id))
        .ok_or_else(|| AppError::InvalidSite(input.site_id.to_string()))?;

    let site_uid = input
        .site_uid_override
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| site.site_uid.trim().to_string());

    if !is_valid_site_uid(&site_uid) {
        return Err(AppError::InvalidSiteUid(site.id.clone()));
    }

    //=-- A full installer URL override wins; otherwise expand the template.
    let installer_url = match input.installer_url_override {
        Some(url) => url.to_string(),
        None => {
            let platform = input
                .platform_override
                .map(|s| s.to_string())
                .or_else(|| config.installer.platform.clone())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .ok_or(AppError::PlatformMissing)?;

            if !is_valid_platform(&platform) {
                return Err(AppError::ConfigInvalid(format!(
                    "Invalid platform '{}': expected a subdomain such as 'concord'",
                    platform
                )));
            }

            let template = config
                .installer
                .download_url_template
                .as_deref()
                .unwrap_or(DEFAULT_DOWNLOAD_URL_TEMPLATE);

            apply_template(template, site, &site_uid, &platform)
        }
    };

    let save_path = input
        .save_path_override
        .map(|s| s.to_string())
        .or_else(|| config.installer.default_save_path.clone())
        .ok_or(AppError::SavePathMissing)?;

    let mut installer_args: Vec<String> = Vec::new();

    //=-- Raw extra args from CLI/env.
    for arg in input.extra_args {
        if !installer_args.contains(arg) {
            installer_args.push(arg.clone());
        }
    }

    Ok(InstallPlan {
        mode: if input.silent {
            "silent"
        } else {
            "ui"
        }
        .to_string(),
        selected_site: site.clone(),
        installer_url,
        save_path,
        installer_args,
    })
}

/// Expands `{{platform}}`, `{{siteUid}}`, `{{id}}`, `{{shortName}}` and `{{displayName}}`.
pub fn apply_template(template: &str, site: &SiteConfig, site_uid: &str, platform: &str) -> String {
    template
        .replace("{{platform}}", platform)
        .replace("{{siteUid}}", site_uid)
        .replace("{{id}}", &site.id)
        .replace("{{shortName}}", &site.short_name)
        .replace("{{displayName}}", &site.display_name)
}

/// Site UIDs are GUID-like; only letters, digits and `-` are allowed since the value is placed in a URL.
pub fn is_valid_site_uid(uid: &str) -> bool {
    !uid.is_empty() && uid.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

/// Platform is a DNS label such as `concord` or `zinfandel`.
pub fn is_valid_platform(platform: &str) -> bool {
    !platform.is_empty()
        && platform
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-')
}

/// Unit tests for install planning.
#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::config::InstallerSection;

    /// Builds a minimal valid config with one site.
    fn config() -> AppConfig {
        AppConfig {
            app: None,
            installer: InstallerSection {
                platform: Some("concord".to_string()),
                default_save_path: Some("C:\\x\\AgentSetup.exe".to_string()),
                ..Default::default()
            },
            defaults: None,
            sites: vec![SiteConfig {
                id: "A".to_string(),
                short_name: "A".to_string(),
                display_name: "Site A".to_string(),
                site_uid: "abc-123".to_string(),
            }],
        }
    }

    /// Builds default planner input for site `a`.
    fn input<'a>() -> InstallPlanInput<'a> {
        InstallPlanInput {
            site_id: "a",
            site_uid_override: None,
            platform_override: None,
            installer_url_override: None,
            save_path_override: None,
            extra_args: &[],
            silent: false,
        }
    }

    /// The default template expands with the configured platform and the site UID.
    #[test]
    fn expands_default_template() {
        let plan = build_install_plan(&config(), &input()).unwrap();
        assert_eq!(
            plan.installer_url,
            "https://concord.rmm.datto.com/download-agent/windows/abc-123"
        );
        assert!(plan.installer_args.is_empty());
    }

    /// A missing platform is reported as `PlatformMissing`.
    #[test]
    fn missing_platform_is_an_error() {
        let mut cfg = config();
        cfg.installer.platform = None;
        assert!(matches!(
            build_install_plan(&cfg, &input()),
            Err(AppError::PlatformMissing)
        ));
    }

    /// A site UID containing path characters is rejected.
    #[test]
    fn rejects_unsafe_site_uid() {
        let mut inp = input();
        inp.site_uid_override = Some("abc/../x");
        assert!(matches!(
            build_install_plan(&config(), &inp),
            Err(AppError::InvalidSiteUid(_))
        ));
    }
}
