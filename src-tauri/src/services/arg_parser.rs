//! Windows-style command-line parsing and startup resolution (CLI > environment > `.env`).

use std::collections::HashMap;

use crate::models::config::AppMode;
use crate::models::startup::StartupArgs;

/// Parses Windows-style arguments: `/key=value`, `-key=value`, `/key value`, `/flag`, `-flag`.
///
/// Keys are lower-cased and surrounding quotes are stripped from values. `silent` is always a flag.
/// A space-separated value may not itself start with `/` or `-` (it would be read as the next key,
/// leaving the first key as a flag); use `key=value` for such values.
pub fn parse_args(raw: &[String]) -> HashMap<String, String> {
    let mut map = HashMap::new();
    let mut i = 0;

    while i < raw.len() {
        let arg = &raw[i];

        if arg.starts_with('/') || arg.starts_with('-') {
            let body = arg[1..].trim();
            if body.is_empty() {
                i += 1;
                continue;
            }

            if let Some(eq) = body.find('=') {
                let key = body[..eq].trim().to_lowercase();
                let val = body[eq + 1..].trim_matches('"').to_string();
                map.insert(key, val);
            } else {
                let key = body.to_lowercase();
                if key == "silent" {
                    map.insert(key, "true".to_string());
                } else if i + 1 < raw.len()
                    && !raw[i + 1].starts_with('/')
                    && !raw[i + 1].starts_with('-')
                {
                    let val = raw[i + 1].trim_matches('"').to_string();
                    map.insert(key, val);
                    i += 1;
                } else {
                    map.insert(key, "true".to_string());
                }
            }
        }

        i += 1;
    }

    map
}

/// Resolves startup arguments with precedence CLI > process environment > `.env` (loaded earlier).
pub fn resolve_startup(raw: &[String]) -> StartupArgs {
    let cli = parse_args(raw);

    let silent = cli.contains_key("silent") || env_bool("SILENT");

    let mode = get_str(&cli, &["mode"], &["MODE"]).and_then(|m| {
        match m.trim().to_lowercase().as_str() {
            "ui" => Some(AppMode::Ui),
            "silent" => Some(AppMode::Silent),
            _ => None,
        }
    });

    StartupArgs {
        mode,
        silent,
        config: get_str(&cli, &["config"], &["CONFIG"]),
        installer_url: get_str(&cli, &["installerurl", "installer_url"], &["INSTALLER_URL"]),
        save_path: get_str(&cli, &["savepath", "save_path"], &["SAVE_PATH"]),
        site: get_str(
            &cli,
            &["site", "siteid", "site_id"],
            &["SITE", "SITE_ID"],
        ),
        site_uid: get_str(
            &cli,
            &["siteuid", "site_uid"],
            &["SITE_UID"],
        ),
        platform: get_str(&cli, &["platform"], &["PLATFORM"]),
        extra_args: get_str(&cli, &["extraargs", "extra_args"], &["EXTRA_ARGS"])
            .map(|s| split_args(&s))
            .unwrap_or_default(),
        log_path: get_str(&cli, &["logpath", "log_path"], &["LOG_PATH"]),
    }
}

/// Returns the first non-empty value found, checking CLI keys first and then environment variables.
fn get_str(cli: &HashMap<String, String>, cli_keys: &[&str], env_keys: &[&str]) -> Option<String> {
    for key in cli_keys {
        if let Some(v) = cli.get(*key) {
            let v = v.trim();
            if !v.is_empty() {
                return Some(v.to_string());
            }
        }
    }

    for key in env_keys {
        if let Ok(v) = std::env::var(key) {
            let v = v.trim().to_string();
            if !v.is_empty() {
                return Some(v);
            }
        }
    }

    None
}

/// Reads a boolean environment variable (`1`, `true`, `yes`, `on`).
fn env_bool(key: &str) -> bool {
    std::env::var(key)
        .map(|v| matches!(v.trim().to_lowercase().as_str(), "1" | "true" | "yes" | "on"))
        .unwrap_or(false)
}

/// Splits a raw argument string on whitespace.
fn split_args(s: &str) -> Vec<String> {
    s.split_whitespace().map(|x| x.to_string()).collect()
}

/// Returns the first existing default config path.
///
/// Search order: `config.json` next to the executable, `config.json` in the working directory,
/// then `../config.json` (so `tauri dev`, which runs from `src-tauri/`, finds the repo-root file).
pub fn default_config_source() -> Option<String> {
    //=-- The exe's own folder wins so a stray parent-folder config can't shadow the one shipped beside it.
    if let Some(path) = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|dir| dir.join("config.json")))
        .filter(|p| p.is_file())
    {
        return Some(path.to_string_lossy().into_owned());
    }

    ["config.json", "../config.json"]
        .into_iter()
        .find(|candidate| std::path::Path::new(candidate).is_file())
        .map(str::to_string)
}

/// Returns the default log path: `%ProgramData%\datt-oh\logs\installer.log`.
pub fn default_log_path() -> String {
    let base = std::env::var("ProgramData").unwrap_or_else(|_| "C:\\ProgramData".to_string());
    format!("{}\\datt-oh\\logs\\installer.log", base)
}
