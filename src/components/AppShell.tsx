import Header from "./Header";
import SiteSelect from "./SiteSelect";
import InstallerStatus from "./InstallerStatus";
import InstallButton from "./InstallButton";
import LogPanel from "./LogPanel";
import ErrorPanel from "./ErrorPanel";
import { useInstaller } from "../state/installerStore";

export default function AppShell() {
  const { phase, config, appVersion } = useInstaller();
  const app = config?.app;
  const footerText = [app?.title, app?.subtitle, appVersion && `v${appVersion}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex min-h-screen flex-col px-4 py-6 sm:px-8">
      <Header />

      {phase === "loading" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-base-content/70">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p>Loading configuration...</p>
        </div>
      ) : (
        <>
          <ErrorPanel />

          <main className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
            <div className="flex flex-col gap-4">
              <SiteSelect />
              <InstallerStatus />
            </div>
            <LogPanel />
          </main>

          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 pt-4 pb-4">
            <div className="text-sm text-base-content/60">
              {phase === "ready" && "Select a site, then install."}
              {phase === "complete" && "Installation complete."}
              {phase === "failed" && "Review the error and log."}
              {(phase === "downloading" || phase === "running") && "Please wait..."}
            </div>
            <InstallButton />
          </div>
        </>
      )}

      <footer className="mx-auto w-full max-w-6xl border-t border-base-300 pt-4 text-center text-xs text-base-content/50">
        {footerText}
      </footer>
    </div>
  );
}
