import { InstallerProvider } from "./state/installerStore";
import AppShell from "./components/AppShell";

/**
 * Application root: wraps the shell in the installer state provider.
 *
 * @returns The provider-wrapped application shell.
 */
export default function App() {
  return (
    <InstallerProvider>
      <AppShell />
    </InstallerProvider>
  );
}
