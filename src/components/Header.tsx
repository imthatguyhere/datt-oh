import logo from "../../resources/logo.webp";
import { useInstaller } from "../state/installerStore";

export default function Header() {
  const { config } = useInstaller();
  const title = config?.app?.title ?? "Datt-Oh!";

  return (
    <header className="mx-auto mb-6 flex w-full max-w-6xl items-center justify-between">
      <div className="flex items-center gap-3">
        <img
          src={logo}
          alt="datt-oh logo"
          className="h-11 w-11 rounded-full shadow-lg shadow-primary/30"
        />
        <div>
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          <p className="text-xs text-base-content/60">Datto RMM Agent Installer</p>
        </div>
      </div>
      <span className="badge badge-outline badge-sm border-primary/40 text-primary">v1.0.0</span>
    </header>
  );
}
