export type AppMode = "ui" | "silent";

export interface AppSection {
  title?: string;
  theme?: string;
}

export interface InstallerSection {
  platform?: string;
  downloadUrlTemplate?: string;
  defaultSavePath?: string;
  defaultMode?: AppMode;
  successExitCodes?: number[];
  sha256?: string;
}

export interface DefaultsSection {
  siteId?: string;
}

export interface SiteConfig {
  id: string;
  shortName: string;
  displayName: string;
  siteUid: string;
}

export interface AppConfig {
  app?: AppSection;
  installer: InstallerSection;
  defaults?: DefaultsSection;
  sites: SiteConfig[];
}

export interface StartupContext {
  mode: string;
  silentUsed: boolean;
  configSource: string | null;
  installerUrl: string | null;
  savePath: string | null;
  siteId: string | null;
  siteUid: string | null;
  platform: string | null;
  extraArgs: string[];
  logPath: string;
}

export interface InstallPlanRequest {
  siteId: string;
}

export interface InstallRequest {
  siteId: string;
}

export interface InstallPlan {
  mode: string;
  selectedSite: SiteConfig;
  installerUrl: string;
  savePath: string;
  installerArgs: string[];
}

export interface DownloadResult {
  destinationPath: string;
  fileSize: number;
  durationMs: number;
  success: boolean;
}

export interface InstallResult {
  success: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  rebootRequired: boolean;
}
