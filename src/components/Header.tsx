import logo from "../../resources/logo.webp";
import { useInstaller } from "../state/installerStore";
import WindowControls from "./WindowControls";

/**
 * Page header: logo, title and subtitle from the config, the app version badge, and the
 * window controls. It is a drag region so it can move the window. `AppShell` pins it in a
 * sticky bar so it stays visible while the page scrolls.
 *
 * @returns The header element.
 */
export default function Header() {
  const { config, appVersion } = useInstaller();
  const title = config?.app?.title ?? "Datt-Oh!";
  const subtitle = config?.app?.subtitle;

  return (
    <header
      data-tauri-drag-region
      className="mx-auto flex w-full max-w-6xl items-center justify-between"
    >
      <div className="pointer-events-none flex items-center gap-3 select-none">
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
      <div className="flex items-center gap-4">
        {appVersion && (
          <span className="badge badge-outline badge-sm pointer-events-none border-primary/40 text-primary select-none">
            v{appVersion}
          </span>
        )}
        <WindowControls />
      </div>
    </header>
  );
}
