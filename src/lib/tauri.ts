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

//=-- Sets the native window title (and the document title). Ignored outside Tauri (plain browser).
export async function setWindowTitle(title: string): Promise<void> {
  document.title = title;
  try {
    await getCurrentWindow().setTitle(title);
  } catch {
    //=-- Not running inside Tauri, or the permission is missing; the document title is enough.
  }
}

//=-- Resizes the window's inner height to `height` (CSS px), keeping the current width and
//=-- never exceeding the available screen height. Ignored outside Tauri.
export async function fitWindowHeight(height: number): Promise<void> {
  try {
    const capped = Math.min(Math.ceil(height), window.screen.availHeight);
    await getCurrentWindow().setSize(new LogicalSize(window.innerWidth, capped));
  } catch {
    //=-- Not running inside Tauri; nothing to resize.
  }
}

//=-- App version as built into the binary (from tauri.conf.json), not from the editable config.
export function getAppVersion(): Promise<string> {
  return getVersion();
}

export function getStartupContext(): Promise<StartupContext> {
  return invoke<StartupContext>("get_startup_context");
}

export function loadConfig(configSource: string): Promise<AppConfig> {
  return invoke<AppConfig>("load_config", { configSource });
}

export function downloadInstaller(url: string, savePath: string): Promise<DownloadResult> {
  return invoke<DownloadResult>("download_installer", { url, savePath });
}

export function runInstaller(
  savePath: string,
  args: string[],
  successCodes?: number[],
): Promise<InstallResult> {
  return invoke<InstallResult>("run_installer", { savePath, args, successCodes });
}

export function buildInstallPlan(request: InstallRequest): Promise<InstallPlan> {
  return invoke<InstallPlan>("build_install_plan", { request });
}

export function installAgent(request: InstallRequest): Promise<InstallResult> {
  return invoke<InstallResult>("install_agent", { request });
}
