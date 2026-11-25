//! Backend services: argument parsing, config loading, planning, downloading, running, and logging.

/// Argument parsing.
pub mod arg_parser;
/// Config loading and validation.
pub mod config_loader;
/// Installer download.
pub mod downloader;
/// Install planning.
pub mod install_planner;
/// Logging helpers.
pub mod logging;
/// Installer execution.
pub mod process_runner;
