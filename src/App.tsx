import { InstallerProvider } from "./state/installerStore";
import AppShell from "./components/AppShell";

export default function App() {
  return (
    <InstallerProvider>
      <AppShell />
    </InstallerProvider>
  );
}
