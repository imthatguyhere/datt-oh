use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[allow(dead_code)]
pub enum ErrorCategory {
    Config,
    Validation,
    Download,
    FileSystem,
    Installer,
    Argument,
    Site,
    Network,
    Unknown,
}

impl ErrorCategory {
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

#[derive(Debug, Error, Clone)]
#[allow(dead_code)]
pub enum AppError {
    #[error("Config path missing")]
    ConfigPathMissing,

    #[error("Failed to load config: {0}")]
    ConfigLoadFailed(String),

    #[error("Config invalid: {0}")]
    ConfigInvalid(String),

    #[error("Missing required argument: {0}")]
    MissingRequiredArgument(String),

    #[error("Invalid site: {0}")]
    InvalidSite(String),

    #[error("Invalid site UID for site: {0}")]
    InvalidSiteUid(String),

    #[error("Datto RMM platform missing (set installer.platform, PLATFORM, or /platform)")]
    PlatformMissing,

    #[error("Save path missing")]
    SavePathMissing,

    #[error("Download failed: {0}")]
    DownloadFailed(String),

    #[error("File system error: {0}")]
    FileSystem(String),

    #[error("Installer failed: {0}")]
    InstallerFailed(String),

    #[error("Network error: {0}")]
    Network(String),

    #[error("Unknown error: {0}")]
    Unknown(String),
}

impl AppError {
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

//=-- Serializes to { category, detail } which the frontend extracts as a readable message.
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
