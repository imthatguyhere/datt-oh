import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import type {
  AppConfig,
  DownloadResult,
  InstallPlan,
  InstallRequest,
  InstallResult,
  StartupContext,
} from "./types";

/**
 * Sets the native window title (and the document title). Ignored outside Tauri.
 *
 * @param title - The new title.
 */
export async function setWindowTitle(title: string): Promise<void> {
  document.title = title;
  try {
    await getCurrentWindow().setTitle(title);
  } catch {
    //=-- Not running inside Tauri, or the permission is missing; the document title is enough.
  }
}

/**
 * Resizes the window's inner height to fit the content, keeping the current width and never
 * exceeding the available screen height. Skipped while maximized. Ignored outside Tauri.
 *
 * @param height - Desired inner height in CSS pixels.
 */
export async function fitWindowHeight(height: number): Promise<void> {
  try {
    const win = getCurrentWindow();
    //=-- A maximized window keeps whatever size the user chose; fitting would un-maximize it.
    if (await win.isMaximized()) return;
    const capped = Math.min(Math.ceil(height), window.screen.availHeight);
    await win.setSize(new LogicalSize(window.innerWidth, capped));
  } catch {
    //=-- Not running inside Tauri; nothing to resize.
  }
}

/**
 * Closes the window (custom window control). Ignored outside Tauri.
 */
export async function closeWindow(): Promise<void> {
  try {
    await getCurrentWindow().close();
  } catch (e) {
    console.warn("closeWindow failed:", e);
  }
}

/**
 * Minimizes the window (custom window control). Ignored outside Tauri.
 */
export async function minimizeWindow(): Promise<void> {
  try {
    await getCurrentWindow().minimize();
  } catch (e) {
    console.warn("minimizeWindow failed:", e);
  }
}

/**
 * Toggles between maximized and normal size (custom window control). Ignored outside Tauri.
 */
export async function toggleMaximizeWindow(): Promise<void> {
  try {
    await getCurrentWindow().toggleMaximize();
  } catch (e) {
    console.warn("toggleMaximizeWindow failed:", e);
  }
}

/**
 * Restores the window to its normal size, only if it is currently maximized. Ignored outside Tauri.
 */
export async function restoreIfMaximized(): Promise<void> {
  try {
    const win = getCurrentWindow();
    if (await win.isMaximized()) await win.unmaximize();
  } catch (e) {
    console.warn("restoreIfMaximized failed:", e);
  }
}

/**
 * Reports the window's maximized state now and whenever it changes (resize events).
 * Ignored outside Tauri.
 *
 * @param onChange - Called with the current maximized state.
 * @returns An unsubscribe function.
 */
export async function watchMaximized(onChange: (maximized: boolean) => void): Promise<() => void> {
  try {
    const win = getCurrentWindow();
    const update = async () => onChange(await win.isMaximized());
    await update();
    return await win.onResized(() => void update());
  } catch (e) {
    console.warn("watchMaximized failed:", e);
    return () => {};
  }
}

/**
 * Gets the app version as built into the binary (from Cargo.toml), not from the editable config.
 *
 * @returns The version string, e.g. "1.0.0".
 */
export function getAppVersion(): Promise<string> {
  return getVersion();
}

/**
 * Gets the resolved startup context (mode, config source, overrides, log path).
 *
 * @returns The startup context from the backend.
 */
export function getStartupContext(): Promise<StartupContext> {
  return invoke<StartupContext>("get_startup_context");
}

/**
 * Loads and validates the JSON config from a local path or URL.
 *
 * @param configSource - Local file path or http(s) URL.
 * @returns The validated config.
 */
export function loadConfig(configSource: string): Promise<AppConfig> {
  return invoke<AppConfig>("load_config", { configSource });
}

/**
 * Downloads the installer to disk.
 *
 * @param url - Installer download URL.
 * @param savePath - Destination file path.
 * @returns Size and timing of the download.
 */
export function downloadInstaller(url: string, savePath: string): Promise<DownloadResult> {
  return invoke<DownloadResult>("download_installer", { url, savePath });
}

/**
 * Runs a previously downloaded installer.
 *
 * @param savePath - Path of the installer executable.
 * @param args - Command-line arguments for the installer.
 * @param successCodes - Exit codes treated as success (backend default: 0 and 3010).
 * @returns The process result.
 */
export function runInstaller(
  savePath: string,
  args: string[],
  successCodes?: number[],
): Promise<InstallResult> {
  return invoke<InstallResult>("run_installer", { savePath, args, successCodes });
}

/**
 * Builds and validates the install plan (download URL, save path, args) before any download.
 *
 * @param request - The selected site.
 * @returns The resolved plan.
 */
export function buildInstallPlan(request: InstallRequest): Promise<InstallPlan> {
  return invoke<InstallPlan>("build_install_plan", { request });
}

/**
 * High-level install: plan, download, and run in one backend call.
 *
 * @param request - The selected site.
 * @returns The installer result.
 */
export function installAgent(request: InstallRequest): Promise<InstallResult> {
  return invoke<InstallResult>("install_agent", { request });
}
