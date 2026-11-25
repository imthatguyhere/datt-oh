<!-- markdownlint-disable -->

# Project Outline: datt-oh (Datto RMM Agent Installer)

## Goal

A Windows desktop app (Tauri v2 + React/TypeScript/Vite + Tailwind v4/daisyUI v5, Rust backend) that downloads and installs the **Datto RMM agent** for a chosen customer site. It supports a graphical mode and a fully silent CLI mode.

## How Datto RMM differs from the VSA 9 predecessor (VS-eh)

| Concern            | VS-eh (Kaseya VSA 9)                    | datt-oh (Datto RMM)                                              |
| ------------------ | --------------------------------------- | ---------------------------------------------------------------- |
| Customer selection | `location` -> `machineGroup`            | `site` -> `siteUid`                                              |
| Binding to the org | `/g=<machineGroup>` installer argument  | Site UID embedded in the per-site agent download URL             |
| Download           | One generic `KcsSetup.exe` URL          | URL built from `platform` + `siteUid` (`downloadUrlTemplate`)    |
| Installer switches | `/r /s /v /w /i /x` checkboxes          | None; only raw `/extraArgs` if ever needed                       |

## Flow

1. Load `.env`, environment, and CLI args (`/arg` and `-arg` styles).
2. Load the JSON config (local path or URL); validate sites (unique ids, safe `siteUid`).
3. Resolve the site (`/site`, config default in silent mode; dropdown in UI mode).
4. Build the download URL from the template, platform, and site UID.
5. Download the installer, run it, map the result to an exit code, and log.

## Open items to verify against a real Datto RMM account

- The exact agent download URL format for your platform/region (`downloadUrlTemplate`).
- Whether the downloaded installer needs any switch for unattended install in your environment.
- Real `siteUid` values for each site in `config.json` (placeholders ship in the repo).

See `README.md` for usage and `FUNCTIONALITY.md` for implementation detail.
