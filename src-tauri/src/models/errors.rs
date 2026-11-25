//! Application error type, its categories, and its silent-mode exit codes.

use serde::Serialize;
use thiserror::Error;

/// Broad error grouping reported to the frontend.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[allow(dead_code)]
pub enum ErrorCategory {
    /// Config could not be found, read, or parsed, or is invalid.
    Config,
    /// Reserved for input validation; not currently produced.
    Validation,
    /// The installer download failed.
    Download,
    /// A file or directory could not be created, read, or written.
    FileSystem,
    /// The installer could not be launched.
    Installer,
    /// A required argument or setting is missing.
    Argument,
    /// The requested site is unknown or has an invalid UID.
    Site,
    /// A network request failed.
    Network,
    /// Anything else.
    Unknown,
}

/// Helpers for [`ErrorCategory`].
impl ErrorCategory {
    /// Returns the lowercase category name.
    pub fn as_str(&self) -> &'static str {
        match self {
            ErrorCategory::Config => "config",
            ErrorCategory::Validation => "validation",
            ErrorCategory::Download => "download",
            ErrorCategory::FileSystem => "filesystem",
            ErrorCategory::Installer => "installer",
            ErrorCategory::Argument => "argument",
            ErrorCategory::Site => "site",
            ErrorCategory::Network => "network",
            ErrorCategory::Unknown => "unknown",
        }
    }
}

/// Every error the backend can report. Serialized to the frontend as `{ category, detail }`.
#[derive(Debug, Error, Clone)]
#[allow(dead_code)]
pub enum AppError {
    /// No config path or URL was found. Exit code 2.
    #[error("Config path missing")]
    ConfigPathMissing,

    /// The config could not be read or fetched. Exit code 2.
    #[error("Failed to load config: {0}")]
    ConfigLoadFailed(String),

    /// The config parsed but failed validation. Exit code 3.
    #[error("Config invalid: {0}")]
    ConfigInvalid(String),

    /// A required argument is missing (not currently produced). Exit code 6.
    #[error("Missing required argument: {0}")]
    MissingRequiredArgument(String),

    /// No site with the requested id exists. Exit code 7.
    #[error("Invalid site: {0}")]
    InvalidSite(String),

    /// The site's UID is empty or contains unsafe characters. Exit code 7.
    #[error("Invalid site UID for site: {0}")]
    InvalidSiteUid(String),

    /// No platform could be resolved for the download URL. Exit code 6.
    #[error("Datto RMM platform missing (set installer.platform, PLATFORM, or /platform)")]
    PlatformMissing,

    /// No save path could be resolved. Exit code 6.
    #[error("Save path missing")]
    SavePathMissing,

    /// The installer download failed. Exit code 8.
    #[error("Download failed: {0}")]
    DownloadFailed(String),

    /// A file or directory operation failed. Exit code 5.
    #[error("File system error: {0}")]
    FileSystem(String),

    /// The installer could not be launched. Exit code 9.
    #[error("Installer failed: {0}")]
    InstallerFailed(String),

    /// A network request failed. Exit code 8.
    #[error("Network error: {0}")]
    Network(String),

    /// Anything else. Exit code 1.
    #[error("Unknown error: {0}")]
    Unknown(String),
}

/// Helpers for [`AppError`].
impl AppError {
    /// Returns the category this error belongs to.
    pub fn category(&self) -> ErrorCategory {
        match self {
            AppError::ConfigPathMissing
            | AppError::ConfigLoadFailed(_)
            | AppError::ConfigInvalid(_) => ErrorCategory::Config,
            AppError::MissingRequiredArgument(_) => ErrorCategory::Argument,
            AppError::InvalidSite(_) | AppError::InvalidSiteUid(_) => {
                ErrorCategory::Site
            }
            AppError::PlatformMissing | AppError::SavePathMissing => ErrorCategory::Argument,
            AppError::DownloadFailed(_) => ErrorCategory::Download,
            AppError::FileSystem(_) => ErrorCategory::FileSystem,
            AppError::InstallerFailed(_) => ErrorCategory::Installer,
            AppError::Network(_) => ErrorCategory::Network,
            AppError::Unknown(_) => ErrorCategory::Unknown,
        }
    }

    /// Returns the silent-mode process exit code for this error.
    pub fn exit_code(&self) -> i32 {
        match self {
            AppError::ConfigPathMissing | AppError::ConfigLoadFailed(_) => 2,
            AppError::ConfigInvalid(_) => 3,
            AppError::MissingRequiredArgument(_) => 6,
            AppError::InvalidSite(_) | AppError::InvalidSiteUid(_) => 7,
            AppError::PlatformMissing | AppError::SavePathMissing => 6,
            AppError::DownloadFailed(_) => 8,
            AppError::FileSystem(_) => 5,
            AppError::InstallerFailed(_) => 9,
            AppError::Network(_) => 8,
            AppError::Unknown(_) => 1,
        }
    }
}

/// Serializes to `{ category, detail }`, which the frontend turns into a readable message.
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut s = serializer.serialize_struct("AppError", 2)?;
        s.serialize_field("category", self.category().as_str())?;
        s.serialize_field("detail", &self.to_string())?;
        s.end()
    }
}
