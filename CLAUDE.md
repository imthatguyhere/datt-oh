# datt-oh — Project Instructions

Fancy UI (Tauri app) for choosing a customer site, then downloading and installing the Datto RMM agent.

## GitHub AI Instructions

This repo has additional AI instructions under [.github/instructions/](.github/instructions/) that apply to every change (`applyTo: "*"`). Always follow these in addition to this file:

- [dependencies.instructions.md](.github/instructions/dependencies.instructions.md) — When adding any package, library, framework, tool, plugin, or build dependency, use the latest stable version from the official package source. Do not add outdated, deprecated, prerelease, beta, RC, nightly, or unmaintained versions unless the user explicitly requests it or the project requires it for compatibility. If the latest stable version can't be used, document the reason (version chosen + compatibility constraint) in the final response or change notes.
- [documentation.instructions.md](.github/instructions/documentation.instructions.md) — Keep `README.md` and `FUNCTIONALITY.md` synchronized with source changes:
  - Update `README.md` for changes affecting user-facing behavior, prerequisites, configuration, CLI flags, output/logging, architecture, module responsibilities, tracked software, build commands, or release packaging.
  - Update `FUNCTIONALITY.md` for changes affecting `src/` behavior, public/exported types, functions, constants, data flow, algorithms, configuration sources, target software definitions, log table structures, build scripts, release profile settings, or release packaging.
  - Required `README.md` structure: Project title/overview, Prerequisites, Building, Configuration (all env vars), Usage (all CLI modes/flags), Output (stdout behavior, log file path pattern, report tables), Architecture/data flow, Modules, Tracked Software.
  - Required `FUNCTIONALITY.md` structure: Data Flow, Configuration, Build/release packaging (when non-default), one H2 per source module (`main.rs`, `installed.rs`, `cdk_info.rs`, `app_logging.rs`) covering purpose/types/constants/public functions/key internal functions/key algorithms, and a Target Software table (`installed_name`, `osd_description`, detection function).
  - When editing Rust source, include doc updates in the same change; if none are needed, note why in the final response.
- [testing.instructions.md](.github/instructions/testing.instructions.md) — This software runs as an installer on other machines. Never run/execute it on the development machine — it can make unintended system changes. Instead, do all possible validation before running (build, lint, type/borrow-check, static review), and if user-requested testing is blocking progress, tell the user exactly what to run/test themselves.

If any file is added to or changed within `.github/instructions/`, re-read it and treat it as authoritative for this repo going forward.
