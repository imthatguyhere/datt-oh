import { useInstaller } from "../state/installerStore";

export default function SiteSelect() {
  const { config, selectedSite, selectSite } = useInstaller();
  if (!config) return null;

  return (
    <section className="glow-panel card rounded-box p-5">
      <h2 className="mb-3 text-lg font-semibold">Site</h2>

      <select
        className="select select-bordered w-full"
        value={selectedSite?.id ?? ""}
        onChange={(e) => selectSite(e.target.value)}
      >
        {config.sites.map((loc) => (
          <option key={loc.id} value={loc.id}>
            {loc.displayName} ({loc.id})
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
