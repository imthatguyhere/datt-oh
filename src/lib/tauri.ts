import { invoke } from "@tauri-apps/api/core";
import type {
  AppConfig,
  DownloadResult,
  InstallPlan,
  InstallRequest,
  InstallResult,
  StartupContext,
} from "./types";

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
