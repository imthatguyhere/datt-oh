import { useMemo } from "react";
import { useInstaller } from "../state/installerStore";

/**
 * Site picker card: dropdown sorted alphabetically by short name (shown as
 * "SHORT — Full name") and details for the selected site.
 *
 * @returns The site selection card.
 */
export default function SiteSelect() {
  const { config, selectedSite, selectSite } = useInstaller();

  //=-- Alphabetical by short name (case-insensitive, numeric-aware so "2X" sorts before "10X").
  const sortedSites = useMemo(
    () =>
      [...(config?.sites ?? [])].sort((a, b) =>
        a.shortName.localeCompare(b.shortName, undefined, { sensitivity: "base", numeric: true }),
      ),
    [config],
  );

  if (!config) return null;

  return (
    <section className="glow-panel card rounded-box p-5">
      <h2 className="mb-3 text-lg font-semibold">Site</h2>

      <select
        className="select select-bordered w-full"
        value={selectedSite?.id ?? ""}
        onChange={(e) => selectSite(e.target.value)}
      >
        {sortedSites.map((loc) => (
          <option key={loc.id} value={loc.id}>
            {loc.shortName} — {loc.displayName}
          </option>
        ))}
      </select>

      {selectedSite && (
        <div className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-base-content/60">Short name</span>
            <span className="font-mono">{selectedSite.shortName}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-base-content/60">Site UID</span>
            <code className="font-mono text-accent">{selectedSite.siteUid}</code>
          </div>
        </div>
      )}
    </section>
  );
}
