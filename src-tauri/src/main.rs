//! datt-oh binary entry point; delegates to the library crate.

//=-- Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// Starts the application.
fn main() {
    datt_oh_lib::run();
}
