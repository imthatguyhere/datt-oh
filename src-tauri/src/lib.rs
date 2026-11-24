//=-- datt-oh library entry point: silent-mode handling + Tauri UI builder.

mod commands;
mod models;
mod services;

use models::config::AppMode;
use models::startup::StartupArgs;
use services::arg_parser::{default_config_source, default_log_path, resolve_startup};
use services::logging::{load_dotenv, write_log};

pub struct AppState {
    pub startup: StartupArgs,
    pub config_source: Option<String>,
    pub log_path: String,
}

pub fn run() {
    load_dotenv();

    let raw_args: Vec<String> = std::env::args().skip(1).collect();
    let startup = resolve_startup(&raw_args);

    let log_path = startup.log_path.clone().unwrap_or_else(default_log_path);
    let config_source = startup.config.clone().or_else(default_config_source);

    let silent = startup.silent || startup.mode == Some(AppMode::Silent);

    write_log(&log_path, "INFO", "datt-oh starting...");
    write_log(
        &log_path,
        "INFO",
        &format!("Mode: {}", if silent { "silent" } else { "ui" }),
    );

    if silent {
        let code = run_silent(startup, config_source, log_path);
        std::process::exit(code);
    }

    let state = AppState {
        startup,
        config_source,
        log_path,
    };

    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::config::get_startup_context,
            commands::config::load_config,
            commands::installer::download_installer,
            commands::installer::run_installer,
            commands::installer::build_install_plan,
            commands::installer::install_agent,
        ])
        .run(tauri::generate_context!())
        .expect("error while running datt-oh application");
}

//=-- Runs the silent install flow synchronously (spins up a tokio runtime).
fn run_silent(startup: StartupArgs, config_source: Option<String>, log_path: String) -> i32 {
    let rt = tokio::runtime::Runtime::new().expect("failed to build tokio runtime");
    rt.block_on(run_silent_async(startup, config_source, log_path))
}

async fn run_silent_async(
    startup: StartupArgs,
    config_source: Option<String>,
    log_path: String,
) -> i32 {
    use services::{config_loader, downloader, install_planner, process_runner};

    let source = match config_source {
        Some(s) => s,
        None => {
            write_log(&log_path, "ERROR", "Config path missing");
            return 2;
        }
    };

    write_log(&log_path, "INFO", &format!("Loading config from: {}", source));
    let config = match config_loader::load_config(&source).await {
        Ok(c) => c,
        Err(e) => {
            write_log(&log_path, "ERROR", &e.to_string());
            return e.exit_code();
        }
    };

    let site_id = match startup
        .site
        .clone()
        .or_else(|| config.defaults.as_ref().and_then(|d| d.site_id.clone()))
    {
        Some(id) => id,
        None => {
            write_log(
                &log_path,
                "ERROR",
                "Site missing and no config default exists",
            );
            return 6;
        }
    };

    let site = match config
        .sites
        .iter()
        .find(|l| l.id.eq_ignore_ascii_case(&site_id))
    {
        Some(l) => l,
        None => {
            write_log(
                &log_path,
                "ERROR",
                &format!("Invalid site id requested: {}", site_id),
            );
            let ids: Vec<&str> = config.sites.iter().map(|l| l.id.as_str()).collect();
            write_log(
                &log_path,
                "INFO",
                &format!("Available site ids: {}", ids.join(", ")),
            );
            return 7;
        }
    };

    let site_uid = startup
        .site_uid
        .clone()
        .unwrap_or_else(|| site.site_uid.clone());
    if site_uid.trim().is_empty() {
        write_log(
            &log_path,
            "ERROR",
            &format!("Matching site has empty siteUid: {}", site.id),
        );
        return 7;
    }

    let plan = match install_planner::build_install_plan(
        &config,
        &install_planner::InstallPlanInput {
            site_id: &site.id,
            site_uid_override: Some(&site_uid),
            platform_override: startup.platform.as_deref(),
            installer_url_override: startup.installer_url.as_deref(),
            save_path_override: startup.save_path.as_deref(),
            selected_arguments: &[],
            extra_args: &startup.extra_args,
            include_silent_args: true,
        },
    ) {
        Ok(p) => p,
        Err(e) => {
            write_log(&log_path, "ERROR", &e.to_string());
            return e.exit_code();
        }
    };

    write_log(
        &log_path,
        "INFO",
        &format!(
            "Site: {} ({})",
            plan.selected_site.display_name, plan.selected_site.id
        ),
    );
    write_log(&log_path, "INFO", &format!("Installer URL: {}", plan.installer_url));
    write_log(&log_path, "INFO", &format!("Save path: {}", plan.save_path));

    write_log(&log_path, "INFO", "Downloading installer...");
    match downloader::download_installer(&plan.installer_url, &plan.save_path).await {
        Ok(r) => write_log(
            &log_path,
            "INFO",
            &format!("Downloaded {} bytes in {} ms", r.file_size, r.duration_ms),
        ),
        Err(e) => {
            write_log(&log_path, "ERROR", &e.to_string());
            return e.exit_code();
        }
    }

    write_log(
        &log_path,
        "INFO",
        &format!(
            "Running installer with args: {}",
            services::logging::redact_args(&plan.installer_args)
        ),
    );

    let success_codes = config
        .installer
        .success_exit_codes
        .clone()
        .unwrap_or_else(|| vec![0, 3010]);

    match process_runner::run_installer(&plan.save_path, &plan.installer_args, &success_codes).await {
        Ok(r) => {
            write_log(&log_path, "INFO", &format!("Installer exit code: {:?}", r.exit_code));
            if r.success {
                if r.reboot_required {
                    write_log(&log_path, "INFO", "Reboot required");
                }
                0
            } else {
                r.exit_code.filter(|c| *c > 0).unwrap_or(9)
            }
        }
        Err(e) => {
            write_log(&log_path, "ERROR", &e.to_string());
            e.exit_code()
        }
    }
}
