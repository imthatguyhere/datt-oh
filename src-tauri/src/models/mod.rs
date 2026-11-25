//! Data types: config, errors, startup arguments, and the DTOs that cross the Tauri boundary.

/// JSON config types.
pub mod config;
/// Error type and exit codes.
pub mod errors;
/// Frontend-facing DTOs.
pub mod installer;
/// Resolved startup arguments.
pub mod startup;
