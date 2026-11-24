use tauri::State;

use crate::models::config::{AppConfig, AppMode};
use crate::models::errors::AppError;
use crate::models::installer::StartupContext;
use crate::services::config_loader;
use crate::AppState;

#[tauri::command]
pub fn get_startup_context(state: State<'_, AppState>) -> StartupContext {
    let silent = state.startup.silent || state.startup.mode == Some(AppMode::Silent);

    StartupContext {
        mode: if silent { "silent" } else { "ui" }.to_string(),
        silent_used: state.startup.silent,
        config_source: state.config_source.clone(),
        installer_url: state.startup.installer_url.clone(),
        save_path: state.startup.save_path.clone(),
        site_id: state.startup.site.clone(),
        site_uid: state.startup.site_uid.clone(),
        platform: state.startup.platform.clone(),
        extra_args: state.startup.extra_args.clone(),
        log_path: state.log_path.clone(),
    }
}

#[tauri::command]
pub async fn load_config(config_source: String) -> Result<AppConfig, AppError> {
    config_loader::load_config(&config_source).await
}
