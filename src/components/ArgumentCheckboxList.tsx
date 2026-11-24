import { useMemo } from "react";
import { useInstaller } from "../state/installerStore";

export default function ArgumentCheckboxList() {
  const { config, selectedArguments, toggleArgument, resetArguments } = useInstaller();
  const options = config?.arguments ?? [];

  const isDefault = useMemo(() => {
    const defaults = options.filter((opt) => opt.defaultChecked).map((opt) => opt.id);
    return (
      defaults.length === selectedArguments.length &&
      defaults.every((id) => selectedArguments.includes(id))
    );
  }, [options, selectedArguments]);

  if (options.length === 0) return null;

  return (
    <section className="glow-panel card rounded-box p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Installer options</h2>
        <button
          type="button"
          className="btn btn-outline btn-xs"
          onClick={resetArguments}
          disabled={isDefault}
        >
          Reset to defaults
        </button>
      </div>

      <div className="space-y-0.5">
        {options.map((opt) => (
          <label
            key={opt.id}
            className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-base-200"
          >
            <input
              type="checkbox"
              className="checkbox checkbox-primary checkbox-sm mt-0.5"
              checked={selectedArguments.includes(opt.id)}
              onChange={() => toggleArgument(opt.id)}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-medium">{opt.label}</span>
              <span className="flex items-start gap-2">
                <code className="badge badge-outline badge-accent badge-sm shrink-0 border-accent/80 font-mono">
                  {opt.argument}
                </code>
                {opt.description && (
                  <span className="min-w-0 flex-1 text-xs text-base-content/60">
                    {opt.description}
                  </span>
                )}
              </span>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
