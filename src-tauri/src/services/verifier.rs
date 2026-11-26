//! Verifies a downloaded installer before it is run: SHA-256 hash, optional expected-hash check,
//! and (on Windows) the Authenticode signature.

use std::io::Read;

use sha2::{Digest, Sha256};

use crate::models::errors::AppError;
use crate::models::installer::VerifyResult;

/// Computes the lowercase hex SHA-256 of the file at `path` by streaming it.
fn sha256_file(path: &str) -> Result<String, AppError> {
    let mut file = std::fs::File::open(path)
        .map_err(|e| AppError::FileSystem(format!("Could not open '{}': {}", path, e)))?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 64 * 1024];
    loop {
        let n = file
            .read(&mut buf)
            .map_err(|e| AppError::FileSystem(format!("Failed reading '{}': {}", path, e)))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hasher
        .finalize()
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect())
}

/// Reads the Authenticode status and signer subject via PowerShell's `Get-AuthenticodeSignature`.
///
/// Returns `("NotChecked", None)` off Windows or if PowerShell cannot be run. The path is passed
/// through an environment variable, never interpolated into the script.
#[cfg(windows)]
async fn authenticode(path: &str) -> (String, Option<String>) {
    use tokio::process::Command;

    const SCRIPT: &str = "$s = Get-AuthenticodeSignature -LiteralPath $env:DATTOH_VERIFY_PATH; \
        $s.Status.ToString(); \
        if ($s.SignerCertificate) { $s.SignerCertificate.Subject }";

    let out = Command::new("powershell.exe")
        .creation_flags(0x0800_0000) //=-- CREATE_NO_WINDOW: no console flash from the GUI app.
        .args(["-NoProfile", "-NonInteractive", "-Command", SCRIPT])
        .env("DATTOH_VERIFY_PATH", path)
        .output()
        .await;

    match out {
        Ok(o) if o.status.success() => {
            let text = String::from_utf8_lossy(&o.stdout).to_string();
            let mut lines = text.lines().map(str::trim).filter(|l| !l.is_empty());
            let status = lines.next().unwrap_or("Unknown").to_string();
            (status, lines.next().map(str::to_string))
        }
        _ => ("NotChecked".to_string(), None),
    }
}

/// Non-Windows builds cannot check Authenticode signatures.
#[cfg(not(windows))]
async fn authenticode(_path: &str) -> (String, Option<String>) {
    ("NotChecked".to_string(), None)
}

/// Verifies the installer at `save_path`.
///
/// Fails (`passed = false`) only when the file is missing/empty or an `expected_sha256` is given
/// and does not match. A signature that is not `Valid` is reported in the result for the user to
/// weigh, not treated as a hard failure.
pub async fn verify_installer(
    save_path: &str,
    expected_sha256: Option<&str>,
) -> Result<VerifyResult, AppError> {
    let meta = std::fs::metadata(save_path)
        .map_err(|e| AppError::FileSystem(format!("Installer not found '{}': {}", save_path, e)))?;
    let file_size = meta.len();
    if file_size == 0 {
        return Err(AppError::FileSystem("Installer file is empty".to_string()));
    }

    let path = save_path.to_string();
    let sha256 = tokio::task::spawn_blocking(move || sha256_file(&path))
        .await
        .map_err(|e| AppError::Unknown(format!("Hashing task failed: {}", e)))??;

    let sha256_matches = expected_sha256
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|exp| exp.eq_ignore_ascii_case(&sha256));

    let (signature_status, signer) = authenticode(save_path).await;

    Ok(VerifyResult {
        file_size,
        sha256,
        sha256_matches,
        signature_status,
        signer,
        passed: sha256_matches != Some(false),
    })
}
