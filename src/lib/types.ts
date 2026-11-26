/**
 * How the app runs: with a window (`ui`) or headless (`silent`).
 */
export type AppMode = "ui" | "silent";

/**
 * Branding shown in the UI (`app` section of the config).
 */
export interface AppSection {
  /** Window and header title. */
  title?: string;
  /** Line shown under the title in the header. */
  subtitle?: string;
  /** daisyUI theme name. Parsed but not currently used (the theme is set in `index.html`). */
  theme?: string;
}

/**
 * Installer settings (`installer` section of the config).
 */
export interface InstallerSection {
  /** Datto RMM platform subdomain (e.g. "concord"); fills `{{platform}}` in the template. */
  platform?: string;
  /** Agent download URL template; supports `{{platform}}` and `{{siteUid}}`. */
  downloadUrlTemplate?: string;
  /** Where the installer is saved. */
  defaultSavePath?: string;
  /** Intended default run mode. Parsed but not currently used. */
  defaultMode?: AppMode;
  /** Exit codes treated as success (default 0 and 3010). */
  successExitCodes?: number[];
  /** Expected SHA-256 of the installer; when set, a downloaded file with a different hash is rejected. */
  sha256?: string;
}

/**
 * Defaults used when nothing else is specified (`defaults` section of the config).
 */
export interface DefaultsSection {
  /** Site id pre-selected in the UI (and used by silent mode when `/site` is omitted). */
  siteId?: string;
}

/**
 * A customer site the agent can be installed for.
 */
export interface SiteConfig {
  /** Unique id (case-insensitive) used by `/site` and `defaults.siteId`. */
  id: string;
  /** Short name shown first in the dropdown ("SHORT — Full name"). */
  shortName: string;
  /** Full customer/site name. */
  displayName: string;
  /** Datto RMM site UID (letters, digits and `-`); placed in the download URL. */
  siteUid: string;
}

/**
 * The full JSON config.
 */
export interface AppConfig {
  app?: AppSection;
  installer: InstallerSection;
  defaults?: DefaultsSection;
  sites: SiteConfig[];
}

/**
 * Resolved startup values (CLI / env / .env) reported by the backend.
 */
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

/**
 * Request to build an install plan for a site.
 */
export interface InstallPlanRequest {
  siteId: string;
}

/**
 * Request to install the agent for a site.
 */
export interface InstallRequest {
  siteId: string;
}

/**
 * A validated install plan: where to download from, where to save, and the installer args.
 */
export interface InstallPlan {
  mode: string;
  selectedSite: SiteConfig;
  installerUrl: string;
  savePath: string;
  installerArgs: string[];
}

/**
 * Outcome of an installer download.
 */
export interface DownloadResult {
  destinationPath: string;
  fileSize: number;
  durationMs: number;
  success: boolean;
}

/**
 * Outcome of verifying a downloaded installer.
 */
export interface VerifyResult {
  fileSize: number;
  sha256: string;
  /** Whether the hash equals `installer.sha256`; `null` when none is configured. */
  sha256Matches: boolean | null;
  /** Authenticode status (`Valid`, `NotSigned`, ...) or `NotChecked`. */
  signatureStatus: string;
  signer: string | null;
  /** `false` only when the file is unusable or a configured hash does not match. */
  passed: boolean;
}

/**
 * Outcome of running the installer.
 */
export interface InstallResult {
  success: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  rebootRequired: boolean;
}
