//! Runs the downloaded installer and interprets its exit code.

use std::time::Instant;

use tokio::process::Command;

use crate::models::errors::AppError;
use crate::models::installer::InstallResult;

/// Runs the installer directly (no shell), capturing stdout, stderr, and the exit code.
///
/// An exit code listed in `success_codes` counts as success. Exit code `3010` always sets
/// `reboot_required`, whether or not it is listed as a success code.
pub async fn run_installer(
    save_path: &str,
    args: &[String],
    success_codes: &[i32],
) -> Result<InstallResult, AppError> {
    let path = std::path::Path::new(save_path);
    if !path.exists() {
        return Err(AppError::FileSystem(format!(
            "Installer not found: {}",
            save_path
        )));
    }

    let start = Instant::now();
    let output = Command::new(save_path)
        .args(args)
        .output()
        .await
        .map_err(|e| AppError::InstallerFailed(format!("Failed to launch installer: {}", e)))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let exit_code = output.status.code();
    let success = exit_code
        .map(|c| success_codes.contains(&c))
        .unwrap_or(false);
    let reboot_required = exit_code == Some(3010);

    Ok(InstallResult {
        success,
        exit_code,
        stdout,
        stderr,
        duration_ms: start.elapsed().as_millis() as u64,
        reboot_required,
    })
}
