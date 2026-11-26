import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  AppConfig,
  InstallPlan,
  InstallResult,
  SiteConfig,
  StartupContext,
  VerifyResult,
} from "../lib/types";
import { extractErrorMessage } from "../lib/errors";
import * as api from "../lib/tauri";

/**
 * Lifecycle phase of the install flow.
 */
export type InstallPhase =
  | "loading"
  | "ready"
  | "confirming"
  | "downloading"
  | "verifying"
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

/**
 * A yes/no question shown in a modal dialog.
 */
export interface ConfirmRequest {
  title: string;
  message: string;
  /** Label/value rows shown under the message. */
  details?: { label: string; value: string }[];
  /** Highlighted warnings (e.g. an unsigned installer), shown above the details. */
  warnings?: string[];
  confirmLabel: string;
  cancelLabel: string;
}

let nextLogId = 1;

/**
 * Builds the warning lines shown in a run confirmation for a verified installer.
 *
 * @param v - The verification result.
 * @returns Warning messages; empty when nothing needs flagging.
 */
function verifyWarnings(v: VerifyResult): string[] {
  const warnings: string[] = [];
  if (v.signatureStatus !== "Valid") {
    warnings.push(
      v.signatureStatus === "NotChecked"
        ? "The digital signature could not be checked."
        : `The digital signature is not valid (${v.signatureStatus}).`,
    );
  }
  if (v.sha256Matches === null) {
    warnings.push("No expected SHA-256 is configured, so the hash was not compared.");
  }
  return warnings;
}

/**
 * Builds the detail rows shown in a confirmation for a verified installer.
 *
 * @param savePath - Path of the installer file.
 * @param v - The verification result.
 * @returns Label/value rows (file, size, hash, signature).
 */
function verifyDetails(savePath: string, v: VerifyResult): { label: string; value: string }[] {
  return [
    { label: "File", value: savePath },
    { label: "Size", value: `${v.fileSize.toLocaleString()} bytes` },
    { label: "SHA-256", value: v.sha256 },
    { label: "Signature", value: v.signatureStatus },
    ...(v.signer ? [{ label: "Signed by", value: v.signer }] : []),
  ];
}

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
  confirm: ConfirmRequest | null;
  answerConfirm: (yes: boolean) => void;
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
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const confirmResolver = useRef<((yes: boolean) => void) | null>(null);

  /**
   * Shows a yes/no dialog and waits for the answer.
   *
   * @param request - The question to show.
   * @returns `true` for yes, `false` for no.
   */
  const ask = useCallback((request: ConfirmRequest) => {
    return new Promise<boolean>((resolve) => {
      confirmResolver.current = resolve;
      setConfirm(request);
    });
  }, []);

  /**
   * Answers the open dialog and closes it.
   *
   * @param yes - The user's answer.
   */
  const answerConfirm = useCallback((yes: boolean) => {
    const resolve = confirmResolver.current;
    confirmResolver.current = null;
    setConfirm(null);
    resolve?.(yes);
  }, []);

  /**
   * Appends a timestamped entry to the on-screen log.
   *
   * @param level - Severity of the entry.
   * @param message - Text to show.
   */
  const addLog = useCallback((level: LogLevel, message: string) => {
    //=-- Build the entry (and take its id) outside the state updater: React may run an updater more
    //=-- than once (StrictMode, queued-update replays), and an impure id there yields duplicate keys.
    const entry: LogEntry = {
      id: nextLogId++,
      time: new Date().toLocaleTimeString(),
      level,
      message,
    };
    setLogs((prev) => [...prev, entry]);
  }, []);

  /**
   * Runs the installer at `savePath` and records the outcome in the phase, result and log.
   *
   * @param savePath - Path of the installer executable.
   * @param args - Command-line arguments for the installer.
   * @param successCodes - Exit codes treated as success.
   */
  const runAt = useCallback(
    async (savePath: string, args: string[], successCodes: number[]) => {
      setPhase("running");
      addLog("info", "Running installer...");
      const res = await api.runInstaller(savePath, args, successCodes);
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
    },
    [addLog],
  );

  /**
   * Handles an installer left on disk from an earlier run: verifies it, shows its details, and
   * asks to install it or (if declined) delete it. Declining both keeps the file. A file whose
   * hash does not match the configured value is never offered for install, only for deletion.
   * Does nothing when no save path is known or no file exists there.
   *
   * @param ctx - Startup context (save path override, extra installer args).
   * @param cfg - The loaded config (default save path, expected hash, success codes).
   * @param isCancelled - Reports whether the calling effect was cancelled.
   */
  const handleExistingInstaller = useCallback(
    async (ctx: StartupContext, cfg: AppConfig, isCancelled: () => boolean) => {
      const savePath = ctx.savePath ?? cfg.installer.defaultSavePath;
      if (!savePath || !(await api.installerExists(savePath)) || isCancelled()) return;

      addLog("info", `Found an existing installer at ${savePath}`);
      setPhase("verifying");
      const v = await api.verifyInstaller(savePath, cfg.installer.sha256);
      if (isCancelled()) return;
      addLog("info", `SHA-256: ${v.sha256}`);
      addLog(
        v.signatureStatus === "Valid" ? "success" : "info",
        `Signature: ${v.signatureStatus}${v.signer ? ` (${v.signer})` : ""}`,
      );

      setPhase("confirming");
      if (v.passed) {
        const installOk = await ask({
          title: "Installer already downloaded",
          message: "An installer from an earlier run is on disk. Run it now?",
          warnings: verifyWarnings(v),
          details: verifyDetails(savePath, v),
          confirmLabel: "Yes, install",
          cancelLabel: "No",
        });
        if (installOk) {
          const args = [...new Set(ctx.extraArgs)];
          await runAt(savePath, args, cfg.installer.successExitCodes ?? [0, 3010]);
          return;
        }
      } else {
        const msg = `Existing installer SHA-256 ${v.sha256} does not match the configured value.`;
        addLog("error", msg);
      }

      const deleteOk = await ask({
        title: "Delete the downloaded installer?",
        message: v.passed
          ? "The installer will be kept unless you delete it."
          : "This file does not match the configured SHA-256 and should not be run. Delete it?",
        details: verifyDetails(savePath, v),
        confirmLabel: "Yes, delete",
        cancelLabel: "Keep it",
      });
      if (deleteOk) {
        await api.deleteInstaller(savePath);
        addLog("success", `Deleted ${savePath}`);
      } else {
        addLog("info", `Kept the existing installer at ${savePath}`);
      }
      setPhase("ready");
    },
    [addLog, ask, runAt],
  );

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

        //=-- Pre-select only a configured default that matches a site; otherwise leave the placeholder.
        const defaultId = cfg.defaults?.siteId;
        setSelectedSiteId(cfg.sites.some((s) => s.id === defaultId) ? (defaultId ?? null) : null);

        addLog("success", `Loaded config with ${cfg.sites.length} site(s)`);
        setPhase("ready");

        //=-- A leftover installer is offered for install/delete before the user picks a site.
        try {
          await handleExistingInstaller(ctx, cfg, () => cancelled);
        } catch (e) {
          //=-- A problem with the leftover file must not look like a config failure.
          if (cancelled) return;
          const msg = extractErrorMessage(e);
          addLog("error", `Could not handle the existing installer: ${msg}`);
          setError(msg);
          setPhase("failed");
        }
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
  }, [addLog, handleExistingInstaller]);

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
   * Runs the install: build the plan, ask to proceed, download, verify, ask again, then run it,
   * updating the phase and log as each step completes, is declined, or fails.
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

      //=-- 2. Confirm before anything is downloaded.
      setPhase("confirming");
      const startOk = await ask({
        title: "Install the Datto RMM agent?",
        message:
          "The installer will be downloaded and verified, and you will be asked again before it runs.",
        details: [
          { label: "Site", value: `${p.selectedSite.shortName} — ${p.selectedSite.displayName}` },
          { label: "Site UID", value: p.selectedSite.siteUid },
          { label: "Download from", value: p.installerUrl },
        ],
        confirmLabel: "Yes, download",
        cancelLabel: "No",
      });
      if (!startOk) {
        addLog("info", "Install cancelled before download.");
        setPhase("ready");
        return;
      }

      //=-- 3. Download.
      setPhase("downloading");
      addLog("info", "Downloading installer...");
      const dl = await api.downloadInstaller(p.installerUrl, p.savePath);
      addLog("success", `Downloaded ${dl.fileSize} bytes in ${dl.durationMs} ms`);

      //=-- 4. Verify the downloaded file (hash, configured checksum, signature).
      setPhase("verifying");
      addLog("info", "Verifying installer...");
      const v = await api.verifyInstaller(p.savePath, config?.installer.sha256);
      addLog("info", `SHA-256: ${v.sha256}`);
      addLog(
        v.signatureStatus === "Valid" ? "success" : "info",
        `Signature: ${v.signatureStatus}${v.signer ? ` (${v.signer})` : ""}`,
      );
      if (!v.passed) {
        throw new Error(`Installer SHA-256 ${v.sha256} does not match the configured value.`);
      }
      if (v.sha256Matches) addLog("success", "SHA-256 matches the configured value.");

      //=-- 5. Confirm before running.
      setPhase("confirming");
      const runOk = await ask({
        title: "Run the installer?",
        message: "The download was verified. Run it now?",
        warnings: verifyWarnings(v),
        details: verifyDetails(p.savePath, v),
        confirmLabel: "Yes, install",
        cancelLabel: "No",
      });
      if (!runOk) {
        addLog("info", `Install cancelled before running. The downloaded file was kept at ${p.savePath}`);
        setPhase("ready");
        return;
      }

      //=-- 6. Run.
      await runAt(p.savePath, p.installerArgs, config?.installer.successExitCodes ?? [0, 3010]);
    } catch (e) {
      const msg = extractErrorMessage(e);
      addLog("error", `Install failed: ${msg}`);
      setError(msg);
      setPhase("failed");
    }
  }, [selectedSiteId, config, addLog, ask, runAt]);

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
      confirm,
      answerConfirm,
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
      confirm,
      answerConfirm,
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
