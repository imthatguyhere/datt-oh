import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  AppConfig,
  InstallPlan,
  InstallResult,
  SiteConfig,
  StartupContext,
} from "../lib/types";
import { extractErrorMessage } from "../lib/errors";
import * as api from "../lib/tauri";

/**
 * Lifecycle phase of the install flow.
 */
export type InstallPhase =
  | "loading"
  | "ready"
  | "downloading"
  | "running"
  | "complete"
  | "failed";

/**
 * Severity of a log entry.
 */
export type LogLevel = "info" | "error" | "success";

/**
 * One line in the on-screen log.
 */
export interface LogEntry {
  id: number;
  time: string;
  level: LogLevel;
  message: string;
}

let nextLogId = 1;

/**
 * Everything the installer context exposes to components.
 */
interface InstallerContextValue {
  phase: InstallPhase;
  startup: StartupContext | null;
  appVersion: string | null;
  config: AppConfig | null;
  error: string | null;
  selectedSite: SiteConfig | null;
  plan: InstallPlan | null;
  result: InstallResult | null;
  logs: LogEntry[];
  selectSite: (id: string) => void;
  install: () => Promise<void>;
  reset: () => void;
}

/**
 * React context holding the installer state; use {@link useInstaller} to read it.
 */
const InstallerContext = createContext<InstallerContextValue | null>(null);

/**
 * Owns the install state machine: loads startup context and config, tracks the selected
 * site, runs the install, and collects log entries.
 *
 * @param props - Provider props.
 * @param props.children - The component tree that may call {@link useInstaller}.
 * @returns The context provider.
 */
export function InstallerProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<InstallPhase>("loading");
  const [startup, setStartup] = useState<StartupContext | null>(null);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [plan, setPlan] = useState<InstallPlan | null>(null);
  const [result, setResult] = useState<InstallResult | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  /**
   * Appends a timestamped entry to the on-screen log.
   *
   * @param level - Severity of the entry.
   * @param message - Text to show.
   */
  const addLog = useCallback((level: LogLevel, message: string) => {
    setLogs((prev) => [
      ...prev,
      {
        id: nextLogId++,
        time: new Date().toLocaleTimeString(),
        level,
        message,
      },
    ]);
  }, []);

  //=-- Load startup context and config on mount.
  useEffect(() => {
    let cancelled = false;

    /**
     * Loads startup context, config and app version on mount. Results are discarded if the
     * effect was cancelled (React StrictMode double-mounts in development).
     */
    async function init() {
      try {
        const ctx = await api.getStartupContext();
        if (cancelled) return;
        api.getAppVersion().then((v) => !cancelled && setAppVersion(v)).catch(() => {});
        setStartup(ctx);
        //=-- Logged after the cancel check so StrictMode's dev double-mount only logs once.
        addLog("info", "Starting datt-oh...");
        addLog("info", `Mode: ${ctx.mode}`);

        if (!ctx.configSource) {
          const msg =
            "No configuration source found. Provide a config path or URL via CLI, environment, or .env.";
          addLog("error", msg);
          setError(msg);
          setPhase("failed");
          return;
        }

        addLog("info", `Loading config from: ${ctx.configSource}`);
        const cfg = await api.loadConfig(ctx.configSource);
        if (cancelled) return;
        setConfig(cfg);
        if (cfg.app?.title) void api.setWindowTitle(cfg.app.title);

        const defaultId = cfg.defaults?.siteId ?? cfg.sites[0]?.id ?? null;
        setSelectedSiteId(defaultId);

        addLog("success", `Loaded config with ${cfg.sites.length} site(s)`);
        setPhase("ready");
      } catch (e) {
        if (cancelled) return;
        const msg = extractErrorMessage(e);
        addLog("error", `Failed to load config: ${msg}`);
        setError(msg);
        setPhase("failed");
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [addLog]);

  const selectedSite = useMemo(
    () => config?.sites.find((loc) => loc.id === selectedSiteId) ?? null,
    [config, selectedSiteId],
  );

  /**
   * Selects a site and clears any previous plan, result and error.
   *
   * @param id - The site id to select.
   */
  const selectSite = useCallback((id: string) => {
    setSelectedSiteId(id);
    setPlan(null);
    setResult(null);
    setError(null);
    setPhase((prev) => (prev === "failed" ? "ready" : prev));
  }, []);

  /**
   * Runs the install: build the plan, download the installer, run it, and update the phase
   * and log as each step completes or fails.
   */
  const install = useCallback(async () => {
    if (!selectedSiteId) {
      const msg = "Please select a site first.";
      addLog("error", msg);
      setError(msg);
      setPhase("failed");
      return;
    }

    setError(null);
    setResult(null);
    setPlan(null);

    try {
      //=-- 1. Build and validate the plan on the backend (before any download).
      const p = await api.buildInstallPlan({
        siteId: selectedSiteId,
        });
      setPlan(p);
      addLog("info", `Site UID: ${p.selectedSite.siteUid}`);
      addLog("info", `Installer URL: ${p.installerUrl}`);
      addLog("info", `Save path: ${p.savePath}`);

      //=-- 2. Download.
      setPhase("downloading");
      addLog("info", "Downloading installer...");
      const dl = await api.downloadInstaller(p.installerUrl, p.savePath);
      addLog("success", `Downloaded ${dl.fileSize} bytes in ${dl.durationMs} ms`);

      //=-- 3. Run.
      setPhase("running");
      addLog("info", "Running installer...");
      const successCodes = config?.installer.successExitCodes ?? [0, 3010];
      const res = await api.runInstaller(p.savePath, p.installerArgs, successCodes);
      setResult(res);

      if (res.success) {
        const reboot = res.rebootRequired ? " — a reboot may be required" : "";
        addLog(
          "success",
          `Installer finished successfully (exit code ${res.exitCode ?? "n/a"})${reboot}`,
        );
        setPhase("complete");
      } else {
        const msg = `Installer exited with code ${res.exitCode ?? "unknown"}.`;
        addLog("error", msg);
        setError(msg);
        setPhase("failed");
      }
    } catch (e) {
      const msg = extractErrorMessage(e);
      addLog("error", `Install failed: ${msg}`);
      setError(msg);
      setPhase("failed");
    }
  }, [selectedSiteId, config, addLog]);

  /**
   * Returns to the ready state, clearing the plan, result and error.
   */
  const reset = useCallback(() => {
    setPhase("ready");
    setPlan(null);
    setResult(null);
    setError(null);
  }, []);

  const value = useMemo<InstallerContextValue>(
    () => ({
      phase,
      startup,
      appVersion,
      config,
      error,
      selectedSite,
      plan,
      result,
      logs,
      selectSite,
      install,
      reset,
    }),
    [
      phase,
      startup,
      appVersion,
      config,
      error,
      selectedSite,
      plan,
      result,
      logs,
      selectSite,
      install,
      reset,
    ],
  );

  return <InstallerContext.Provider value={value}>{children}</InstallerContext.Provider>;
}

/**
 * Reads the installer context.
 *
 * @throws If called outside an {@link InstallerProvider}.
 * @returns The installer state and actions.
 */
export function useInstaller(): InstallerContextValue {
  const ctx = useContext(InstallerContext);
  if (!ctx) {
    throw new Error("useInstaller must be used within an InstallerProvider");
  }
  return ctx;
}
