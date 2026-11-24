use std::io::Write;
use std::path::Path;
use std::time::Instant;

use crate::models::errors::AppError;
use crate::models::installer::DownloadResult;

pub async fn download_installer(url: &str, save_path: &str) -> Result<DownloadResult, AppError> {
    let start = Instant::now();

    let path = Path::new(save_path);
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|e| {
                AppError::FileSystem(format!(
                    "Could not create directory '{}': {}",
                    parent.display(),
                    e
                ))
            })?;
        }
    }

    let client = reqwest::Client::new();
    let mut resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| AppError::DownloadFailed(format!("Failed to fetch '{}': {}", url, e)))?;

    if !resp.status().is_success() {
        return Err(AppError::DownloadFailed(format!(
            "HTTP {} from '{}'",
            resp.status(),
            url
        )));
    }

    let mut file = std::fs::File::create(path).map_err(|e| {
        AppError::FileSystem(format!("Could not create '{}': {}", save_path, e))
    })?;

    let mut total: u64 = 0;
    while let Some(chunk) = resp.chunk().await.map_err(|e| {
        AppError::DownloadFailed(format!("Failed reading response body: {}", e))
    })? {
        file.write_all(&chunk).map_err(|e| {
            AppError::FileSystem(format!("Failed writing '{}': {}", save_path, e))
        })?;
        total += chunk.len() as u64;
    }

    file.flush().ok();
    drop(file);

    if total == 0 {
        return Err(AppError::DownloadFailed(
            "Downloaded file is empty (0 bytes)".to_string(),
        ));
    }

    Ok(DownloadResult {
        destination_path: save_path.to_string(),
        file_size: total,
        duration_ms: start.elapsed().as_millis() as u64,
        success: true,
    })
}
