//! Tauri commands for planning, downloading, and running the Datto RMM agent installer.

use tauri::State;

use crate::models::config::AppConfig;
use crate::models::errors::AppError;
use crate::models::installer::{DownloadResult, InstallPlan, InstallRequest, InstallResult};
use crate::services::{
    config_loader, downloader, install_planner,
    logging::{redact_args, write_log},
    process_runner,
};
use crate::AppState;

/// Downloads the installer from `url` to `save_path`.
#[tauri::command]
pub async fn download_installer(url: String, save_path: String) -> Result<DownloadResult, AppError> {
    downloader::download_installer(&url, &save_path).await
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
