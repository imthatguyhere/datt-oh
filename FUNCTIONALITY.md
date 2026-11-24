# FUNCTIONALITY.md

Implementation notes for datt-oh. Describes data flow, configuration, build/release packaging, and the behavior of each source module.

## Data Flow

```mermaid
sequenceDiagram
    participant CLI as CLI / env / .env
    participant Boot as lib.rs run()
    participant UI as React UI
    participant Cmd as Tauri commands
    participant Svc as Rust services

    Boot->>Boot: load .env, resolve startup args, detect mode
    alt silent mode
        Boot->>Svc: config_loader (local/remote)
        Boot->>Svc: install_planner (resolve site → download URL from siteUid)
        Boot->>Svc: downloader
        Boot->>Svc: process_runner
        Boot->>Boot: exit(code)
    else ui mode
        Boot->>Cmd: register commands, launch window
        UI->>Cmd: get_startup_context
        UI->>Cmd: load_config
        UI->>Cmd: build_install_plan
        UI->>Cmd: download_installer
        UI->>Cmd: run_installer
    end
```

The Rust backend is authoritative. The frontend never touches the filesystem, downloads, or process execution directly.

## Configuration

Precedence (highest first): CLI args → environment variables → `.env` → JSON config defaults → hardcoded safe defaults.

- **CLI parsing** (`services/arg_parser.rs`) accepts `/key=value`, `-key=value`, `/key value`, `-key value`, `/flag`, and quoted values. `siteId` is an alias for `site`; `/silent` implies `mode=silent`.
- **`.env` loading** (`services/logging.rs::load_dotenv`) tries `../.env`, `.env`, then `<exe-dir>/.env`.
- **JSON config** (`services/config_loader.rs`) loads a local path or HTTP(S) URL, parses with serde, and validates (non-empty `sites`, unique case-insensitive `id`, non-empty `siteUid` limited to letters/digits/`-`).

## Build and release packaging

- Frontend: `npm run build` runs `tsc` then `vite build`, emitting to `dist/`.
- Backend: `cargo build` via `tauri build`. `build.rs` invokes `tauri_build::build()`.
- `src-tauri/tauri.conf.json` wires `devUrl` (dev server) and `frontendDist: ../dist` (production).
- `crate-type = ["lib", "staticlib"]` — `cdylib` is intentionally omitted because it triggers the GNU linker's export-ordinal limit on Windows.
- Icons are generated from `src-tauri/app-icon.svg` via `npx tauri icon`.
- The release binary uses `windows_subsystem = "windows"` (no console window).

## main.rs

Binary entry point.

- `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` hides the console in release.
- `fn main()` delegates to `datt_oh_lib::run()`.

## lib.rs

Library entry point and orchestration.

- **`AppState`** — managed Tauri state holding `startup: StartupArgs`, `config_source: Option<String>`, `log_path: String`.
- **`run()`** — loads `.env`, resolves startup args, determines mode, and branches:
  - silent → `run_silent` then `std::process::exit(code)`
  - ui → builds the `tauri::Builder` with `.manage(state)` and the registered command handler.
- **`run_silent` / `run_silent_async`** — the silent install flow: load config → resolve site (case-insensitive, with config default fallback) → build plan → download → run → map result to an exit code. Exit codes follow the `AppError::exit_code` table plus `0` for success.

## commands/

Tauri `#[tauri::command]` surface.

### `config.rs`

- `get_startup_context` → `StartupContext` (mode, config source, overrides, log path).
- `load_config` → `AppConfig` (validated).

### `installer.rs`

- `download_installer(url, save_path)` → `DownloadResult`.
- `run_installer(save_path, args, success_codes)` → `InstallResult`.
- `build_install_plan(state, request)` → `InstallPlan` (validates before any download).
- `install_agent(state, request)` → `InstallResult` (high-level: plan + download + run).
- `load_state_config` helper reloads config from the resolved `config_source`.

## services/

### `arg_parser.rs`

- `parse_args` — Windows-style arg tokenizer (key/value, flags, quoted values).
- `resolve_startup` — merges CLI and env into `StartupArgs`.
- `default_config_source` — first existing of `../config.json`, `config.json`, `./config.json`.
- `default_log_path` — `%ProgramData%\datt-oh\logs\installer.log`.

### `config_loader.rs`

- `load_config` — local file or HTTP(S) URL → `AppConfig`.
- `validate_config` — non-empty sites, unique ids, non-empty site UIDs.

### `downloader.rs`

- `download_installer` — creates parent dirs, streams the body to the destination, rejects zero-byte files, returns size/duration.

### `process_runner.rs`

- `run_installer` — verifies the file exists, runs it directly via `tokio::process::Command` (no shell), captures stdout/stderr and exit code, and treats configured success codes (default `[0, 3010]`) as success.

### `install_planner.rs`

- `build_install_plan` — resolves the site by id, validates the site UID (`is_valid_site_uid`: letters, digits, `-`), builds the download URL (an `installerUrl` override wins; otherwise `installer.downloadUrlTemplate` or `DEFAULT_DOWNLOAD_URL_TEMPLATE`, with the platform from override → `installer.platform`, else `PlatformMissing`), then appends checkbox args, silent args (silent mode), and raw extra args (deduplicated). No site argument is passed to the installer; the site binding lives in the download URL.
- `apply_template` — substitutes `{{platform}}`, `{{siteUid}}`, `{{id}}`, `{{shortName}}`, `{{displayName}}`.
- `is_valid_site_uid` / `is_valid_platform` — character allow-lists, since both values are placed in a URL.
- Unit tests cover default template expansion, missing platform, and unsafe site UIDs.

### `logging.rs`

- `load_dotenv` — loads `.env` from candidate sites.
- `write_log` — appends a timestamped, leveled line to the log file (creating parents).
- `redact_args` / `redact_arg` — masks values whose key contains a sensitive token (password/secret/token/key/apikey/auth/credential).
- `timestamp` / `civil_from_days` — dependency-free UTC ISO-8601 timestamp.

## models/

### `config.rs`

`AppConfig`, `AppSection`, `InstallerSection`, `DefaultsSection`, `SiteConfig`, `InstallerArgumentOption`, `AppMode`. JSON uses camelCase keys (`platform`, `downloadUrlTemplate`, `siteUid`, etc.).

### `errors.rs`

`AppError` (thiserror) with `category()`, `exit_code()`, and a manual `Serialize` impl emitting `{ category, detail }` for the frontend. `ErrorCategory` enumerates config/validation/download/filesystem/installer/argument/site/network/unknown.

### `installer.rs`

DTOs for the Tauri boundary: `StartupContext`, `InstallRequest`, `InstallPlan`, `DownloadResult`, `InstallResult` (all `camelCase`).

### `startup.rs`

`StartupArgs` — resolved CLI/env startup values.

## Target software

| installed_name | osd_description    | detection function                                 |
| -------------- | ------------------ | -------------------------------------------------- |
| Datto agent    | Datto RMM agent | Site-specific installer download (`siteUid` in URL) + execution |
