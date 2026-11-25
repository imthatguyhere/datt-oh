import logo from "../../resources/logo.webp";
import { useInstaller } from "../state/installerStore";

export default function Header() {
  const { config, appVersion } = useInstaller();
  const title = config?.app?.title ?? "Datt-Oh!";
  const subtitle = config?.app?.subtitle;

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
          {subtitle && <p className="text-xs text-base-content/60">{subtitle}</p>}
        </div>
      </div>
      {appVersion && (
        <span className="badge badge-outline badge-sm border-primary/40 text-primary">
          v{appVersion}
        </span>
      )}
    </header>
  );
}
