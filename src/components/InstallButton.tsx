import { useInstaller } from "../state/installerStore";

/**
 * Primary action button that starts the install; disabled while busy, after completion, or
 * when no site is selected.
 *
 * @returns The install button.
 */
export default function InstallButton() {
  const { phase, selectedSite, install } = useInstaller();

  const busy = phase === "downloading" || phase === "verifying" || phase === "running";
  const disabled = busy || phase === "confirming" || phase === "loading" || phase === "complete" || !selectedSite;

  return (
    <button
      type="button"
      className="btn btn-primary btn-lg gap-2 shadow-lg shadow-primary/30 disabled:border-base-content/30 disabled:bg-base-300 disabled:shadow-none disabled:text-[color-mix(in_srgb,currentColor,black_30%)]"
      onClick={install}
      disabled={disabled}
    >
      {busy && <span className="loading loading-spinner loading-sm" />}
      {busy ? "Installing..." : phase === "complete" ? "Install Complete" : "Install Agent"}
    </button>
  );
}
