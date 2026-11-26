//! Tauri commands for planning, downloading, and running the Datto RMM agent installer.

use tauri::State;

use crate::models::config::AppConfig;
use crate::models::errors::AppError;
use crate::models::installer::{
    DownloadResult, InstallPlan, InstallRequest, InstallResult, VerifyResult,
};
use crate::services::{
    config_loader, downloader, install_planner,
    logging::{redact_args, write_log},
    process_runner, verifier,
};
use crate::AppState;

/// Downloads the installer from `url` to `save_path`.
#[tauri::command]
pub async fn download_installer(url: String, save_path: String) -> Result<DownloadResult, AppError> {
    downloader::download_installer(&url, &save_path).await
}

/// Verifies the downloaded installer at `save_path` (SHA-256, optional expected hash, signature).
#[tauri::command]
pub async fn verify_installer(
    state: State<'_, AppState>,
    save_path: String,
    expected_sha256: Option<String>,
) -> Result<VerifyResult, AppError> {
    let result = verifier::verify_installer(&save_path, expected_sha256.as_deref()).await?;
    write_log(
        &state.log_path,
        if result.passed { "INFO" } else { "ERROR" },
        &format!(
            "Verified installer: sha256={} signature={} signer={} hashMatch={:?}",
            result.sha256,
            result.signature_status,
            result.signer.as_deref().unwrap_or("-"),
            result.sha256_matches
        ),
    );
    Ok(result)
}

/// Reports whether a regular file already exists at `save_path` (a leftover installer).
#[tauri::command]
pub fn installer_exists(save_path: String) -> bool {
    std::path::Path::new(&save_path).is_file()
}

/// Deletes the leftover installer at `save_path`. Only regular files are removed.
#[tauri::command]
pub fn delete_installer(state: State<'_, AppState>, save_path: String) -> Result<(), AppError> {
    let path = std::path::Path::new(&save_path);
    if !path.is_file() {
        return Err(AppError::FileSystem(format!(
            "Not a file, refusing to delete: '{}'",
            save_path
        )));
    }
    std::fs::remove_file(path)
        .map_err(|e| AppError::FileSystem(format!("Could not delete '{}': {}", save_path, e)))?;
    write_log(&state.log_path, "INFO", &format!("Deleted installer {}", save_path));
    Ok(())
}

/// Runs the installer at `save_path` with `args`.
///
/// `success_codes` defaults to `[0, 3010]` when not provided.
#[tauri::command]
pub async fn run_installer(
    save_path: String,
    args: Vec<String>,
    success_codes: Option<Vec<i32>>,
) -> Result<InstallResult, AppError> {
    let codes = success_codes.unwrap_or_else(|| vec![0, 3010]);
    process_runner::run_installer(&save_path, &args, &codes).await
}

/// Builds and validates the install plan for the requested site, before any download.
#[tauri::command]
pub async fn build_install_plan(
    state: State<'_, AppState>,
    request: InstallRequest,
) -> Result<InstallPlan, AppError> {
    let config = load_state_config(&state).await?;

    let site_uid_override = state.startup.site_uid.clone();
    let platform_override = state.startup.platform.clone();
    let installer_url_override = state.startup.installer_url.clone();
    let save_path_override = state.startup.save_path.clone();
    let extra_args = state.startup.extra_args.clone();

    install_planner::build_install_plan(
        &config,
        &install_planner::InstallPlanInput {
            site_id: &request.site_id,
            site_uid_override: site_uid_override.as_deref(),
            platform_override: platform_override.as_deref(),
            installer_url_override: installer_url_override.as_deref(),
            save_path_override: save_path_override.as_deref(),
            extra_args: &extra_args,
            silent: false,
        },
    )
}

/// High-level install: build the plan, download the installer, then run it, logging each step.
#[tauri::command]
pub async fn install_agent(
    state: State<'_, AppState>,
    request: InstallRequest,
) -> Result<InstallResult, AppError> {
    let config = load_state_config(&state).await?;
    let log_path = state.log_path.clone();

    let site_uid_override = state.startup.site_uid.clone();
    let platform_override = state.startup.platform.clone();
    let installer_url_override = state.startup.installer_url.clone();
    let save_path_override = state.startup.save_path.clone();
    let extra_args = state.startup.extra_args.clone();

    let plan = install_planner::build_install_plan(
        &config,
        &install_planner::InstallPlanInput {
            site_id: &request.site_id,
            site_uid_override: site_uid_override.as_deref(),
            platform_override: platform_override.as_deref(),
            installer_url_override: installer_url_override.as_deref(),
            save_path_override: save_path_override.as_deref(),
            extra_args: &extra_args,
            silent: false,
        },
    )?;

    write_log(
        &log_path,
        "INFO",
        &format!("Downloading installer from {}", plan.installer_url),
    );
    let dl = downloader::download_installer(&plan.installer_url, &plan.save_path).await?;
    write_log(
        &log_path,
        "INFO",
        &format!("Downloaded {} bytes to {}", dl.file_size, dl.destination_path),
    );

    let verified =
        verifier::verify_installer(&plan.save_path, config.installer.sha256.as_deref()).await?;
    if !verified.passed {
        return Err(AppError::InstallerFailed(format!(
            "Installer SHA-256 {} does not match the configured value",
            verified.sha256
        )));
    }

    let success_codes = config
        .installer
        .success_exit_codes
        .clone()
        .unwrap_or_else(|| vec![0, 3010]);

    write_log(
        &log_path,
        "INFO",
        &format!("Running installer with args: {}", redact_args(&plan.installer_args)),
    );

    let result =
        process_runner::run_installer(&plan.save_path, &plan.installer_args, &success_codes)
            .await?;

    write_log(
        &log_path,
        "INFO",
        &format!("Installer exit code: {:?}", result.exit_code),
    );

    Ok(result)
}

/// Reloads the config from the source resolved at startup.
async fn load_state_config(state: &State<'_, AppState>) -> Result<AppConfig, AppError> {
    let source = state
        .config_source
        .clone()
        .ok_or(AppError::ConfigPathMissing)?;
    config_loader::load_config(&source).await
}
