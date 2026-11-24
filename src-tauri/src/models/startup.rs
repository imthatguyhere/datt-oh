use crate::models::config::AppMode;

#[derive(Debug, Clone, Default)]
pub struct StartupArgs {
    pub mode: Option<AppMode>,
    pub silent: bool,
    pub config: Option<String>,
    pub installer_url: Option<String>,
    pub save_path: Option<String>,
    pub site: Option<String>,
    pub site_uid: Option<String>,
    pub platform: Option<String>,
    pub extra_args: Vec<String>,
    pub log_path: Option<String>,
}
