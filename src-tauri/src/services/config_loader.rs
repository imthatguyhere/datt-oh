use crate::models::config::AppConfig;
use crate::models::errors::AppError;
use crate::services::install_planner::is_valid_site_uid;

pub async fn load_config(source: &str) -> Result<AppConfig, AppError> {
    let source = source.trim();

    let content = if source.starts_with("http://") || source.starts_with("https://") {
        load_remote(source).await?
    } else {
        load_local(source)?
    };

    let config: AppConfig = serde_json::from_str(&content)
        .map_err(|e| AppError::ConfigInvalid(format!("Invalid JSON: {}", e)))?;

    validate_config(&config)?;
    Ok(config)
}

fn load_local(path: &str) -> Result<String, AppError> {
    std::fs::read_to_string(path).map_err(|e| {
        AppError::ConfigLoadFailed(format!("Could not read '{}': {}", path, e))
    })
}

async fn load_remote(url: &str) -> Result<String, AppError> {
    let client = reqwest::Client::new();
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| AppError::Network(format!("Failed to fetch '{}': {}", url, e)))?;

    if !resp.status().is_success() {
        return Err(AppError::ConfigLoadFailed(format!(
            "HTTP {} from '{}'",
            resp.status(),
            url
        )));
    }

    resp.text().await.map_err(|e| {
        AppError::ConfigLoadFailed(format!("Failed to read body from '{}': {}", url, e))
    })
}

pub fn validate_config(config: &AppConfig) -> Result<(), AppError> {
    if config.sites.is_empty() {
        return Err(AppError::ConfigInvalid(
            "'sites' array must not be empty".to_string(),
        ));
    }

    let mut seen = std::collections::HashSet::new();
    for loc in &config.sites {
        if loc.id.trim().is_empty() {
            return Err(AppError::ConfigInvalid(
                "A site has an empty 'id'".to_string(),
            ));
        }

        let key = loc.id.trim().to_lowercase();
        if !seen.insert(key) {
            return Err(AppError::ConfigInvalid(format!(
                "Duplicate site id: {}",
                loc.id
            )));
        }

        if loc.site_uid.trim().is_empty() {
            return Err(AppError::ConfigInvalid(format!(
                "Site '{}' has an empty 'siteUid'",
                loc.id
            )));
        }

        if !is_valid_site_uid(loc.site_uid.trim()) {
            return Err(AppError::ConfigInvalid(format!(
                "Site '{}' has an invalid 'siteUid' (letters, digits and '-' only)",
                loc.id
            )));
        }
    }

    Ok(())
}
