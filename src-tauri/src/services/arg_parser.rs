use std::collections::HashMap;

use crate::models::config::AppMode;
use crate::models::startup::StartupArgs;

//=-- Parses Windows-style args: /key=value, -key=value, /key value, /flag, -flag.
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

//=-- Resolves startup args with precedence: CLI > process env > .env (loaded earlier).
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

fn env_bool(key: &str) -> bool {
    std::env::var(key)
        .map(|v| matches!(v.trim().to_lowercase().as_str(), "1" | "true" | "yes" | "on"))
        .unwrap_or(false)
}

fn split_args(s: &str) -> Vec<String> {
    s.split_whitespace().map(|x| x.to_string()).collect()
}

//=-- First existing candidate, accounting for `tauri dev` running from src-tauri/.
pub fn default_config_source() -> Option<String> {
    for candidate in ["../config.json", "config.json", "./config.json"] {
        if std::path::Path::new(candidate).exists() {
            return Some(candidate.to_string());
        }
    }
    None
}

pub fn default_log_path() -> String {
    let base = std::env::var("ProgramData").unwrap_or_else(|_| "C:\\ProgramData".to_string());
    format!("{}\\datt-oh\\logs\\installer.log", base)
}
