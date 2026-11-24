import { useInstaller } from "../state/installerStore";

const phaseLabel: Record<string, string> = {
  loading: "Loading config",
  ready: "Ready",
  downloading: "Downloading installer",
  running: "Running installer",
  complete: "Complete",
  failed: "Failed",
};

const phaseBadge: Record<string, string> = {
  loading: "badge-info",
  ready: "badge-success",
  downloading: "badge-warning",
  running: "badge-warning",
  complete: "badge-success",
  failed: "badge-error",
};

export default function InstallerStatus() {
  const { phase, selectedSite, plan, result } = useInstaller();

  return (
    <section className="glow-panel card rounded-box p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Status</h2>
        <span className={`badge ${phaseBadge[phase] ?? "badge-neutral"}`}>
          {phaseLabel[phase] ?? phase}
        </span>
      </div>

      <div className="space-y-1 text-sm">
        {selectedSite && (
          <div className="flex justify-between gap-2">
            <span className="text-base-content/60">Site UID</span>
            <code className="font-mono text-accent">{selectedSite.siteUid}</code>
          </div>
        )}

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
            <div className="mt-2">
              <span className="text-base-content/60">Arguments</span>
              <pre className="mt-1 overflow-x-auto rounded-lg bg-base-200 p-2 font-mono text-xs text-base-content/80">
                {plan.installerArgs.join(" ")}
              </pre>
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
