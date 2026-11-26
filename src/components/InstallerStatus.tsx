import { useInstaller } from "../state/installerStore";

/**
 * Human-readable label for each install phase.
 */
const phaseLabel: Record<string, string> = {
  loading: "Loading config",
  ready: "Ready",
  confirming: "Waiting for confirmation",
  downloading: "Downloading installer",
  verifying: "Verifying installer",
  running: "Running installer",
  complete: "Complete",
  failed: "Failed",
};

/**
 * daisyUI badge class for each install phase.
 */
const phaseBadge: Record<string, string> = {
  loading: "badge-info",
  ready: "badge-success",
  confirming: "badge-info",
  downloading: "badge-warning",
  verifying: "badge-warning",
  running: "badge-warning",
  complete: "badge-success",
  failed: "badge-error",
};

/**
 * Status card: current phase badge, plus the installer URL, save path and exit code once known.
 *
 * @returns The status card.
 */
export default function InstallerStatus() {
  const { phase, plan, result } = useInstaller();

  return (
    <section className="glow-panel card rounded-box p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Status</h2>
        <span className={`badge ${phaseBadge[phase] ?? "badge-neutral"}`}>
          {phaseLabel[phase] ?? phase}
        </span>
      </div>

      <div className="space-y-1 text-sm">
        {plan && (
          <>
            <div className="flex justify-between gap-2">
              <span className="text-base-content/60">Installer URL</span>
              <span className="truncate text-right">{plan.installerUrl}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-base-content/60">Save path</span>
              <span className="truncate text-right font-mono">{plan.savePath}</span>
            </div>
          </>
        )}

        {result && (
          <div className="mt-2 flex justify-between gap-2">
            <span className="text-base-content/60">Exit code</span>
            <code className="font-mono">{result.exitCode ?? "n/a"}</code>
          </div>
        )}
      </div>
    </section>
  );
}
