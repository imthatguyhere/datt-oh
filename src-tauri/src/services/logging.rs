//! `.env` loading, file logging, argument redaction, and a dependency-free UTC timestamp.

use std::fs::OpenOptions;
use std::io::Write;
use std::path::Path;

/// Loads the first existing `.env` from `../.env`, `.env`, then `<exe-dir>/.env` (`tauri dev` runs from
/// `src-tauri/`, so the parent directory is checked first). Only one file is loaded.
pub fn load_dotenv() {
    let mut candidates = vec!["../.env".to_string(), ".env".to_string()];

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join(".env").to_string_lossy().to_string());
        }
    }

    for candidate in candidates {
        if Path::new(&candidate).exists() {
            let _ = dotenvy::from_path(&candidate);
            return;
        }
    }
}

/// Appends a timestamped, leveled line to the log file, creating parent directories as needed.
///
/// Logging failures are ignored so they can never break an install.
pub fn write_log(log_path: &str, level: &str, message: &str) {
    let line = format!("[{}] {} {}\n", timestamp(), level, message);

    if let Some(parent) = Path::new(log_path).parent() {
        if !parent.as_os_str().is_empty() {
            let _ = std::fs::create_dir_all(parent);
        }
    }

    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
    {
        let _ = file.write_all(line.as_bytes());
    }
}

/// Joins arguments for logging, masking values whose key looks sensitive.
pub fn redact_args(args: &[String]) -> String {
    args.iter()
        .map(|a| redact_arg(a))
        .collect::<Vec<_>>()
        .join(" ")
}

/// Masks the value of a `key=value` / `key:value` argument when the key (ignoring leading `/` or `-`)
/// contains a sensitive word. Arguments without `=` or `:` are returned unchanged.
fn redact_arg(arg: &str) -> String {
    if let Some(eq) = arg.find(['=', ':']) {
        let key = arg[..eq]
            .trim_start_matches(['/', '-'])
            .to_lowercase();
        /// Key fragments that mark an argument value as sensitive.
        const SENSITIVE: &[&str] = &[
            "password",
            "secret",
            "token",
            "key",
            "apikey",
            "api_key",
            "auth",
            "credential",
        ];
        if SENSITIVE.iter().any(|s| key.contains(s)) {
            return format!("{}***REDACTED***", &arg[..=eq]);
        }
    }
    arg.to_string()
}

/// Dependency-free UTC timestamp formatted as ISO-8601.
fn timestamp() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs();
    let days = (secs / 86_400) as i64;
    let rem = secs % 86_400;

    let (year, month, day) = civil_from_days(days);
    let hour = rem / 3600;
    let min = (rem % 3600) / 60;
    let sec = rem % 60;

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hour, min, sec
    )
}

/// Converts days since the Unix epoch to a `(year, month, day)` tuple.
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let mut y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    if m <= 2 {
        y += 1;
    }
    (y, m as u32, d as u32)
}
