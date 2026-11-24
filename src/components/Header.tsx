import { useInstaller } from "../state/installerStore";

export default function Header() {
  const { config } = useInstaller();
  const title = config?.app?.title ?? "datt-oh";

  return (
    <header className="mx-auto mb-6 flex w-full max-w-6xl items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br from-primary to-accent shadow-lg shadow-primary/30">
          <span className="text-lg font-black text-primary-content">D</span>
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          <p className="text-xs text-base-content/60">Datto RMM Agent Installer</p>
        </div>
      </div>
      <span className="badge badge-outline badge-sm border-primary/40 text-primary">v1.0.0</span>
    </header>
  );
}
