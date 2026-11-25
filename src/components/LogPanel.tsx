import { useInstaller } from "../state/installerStore";

const levelClass: Record<string, string> = {
  info: "text-base-content/70",
  success: "text-success",
  error: "text-error",
};

export default function LogPanel() {
  const { logs } = useInstaller();

  return (
    <section className="glow-panel card w-full rounded-box p-5">
      <h2 className="mb-3 text-lg font-semibold">Log</h2>
      <div className="max-h-96 overflow-y-auto rounded-lg bg-base-200/50 p-3 font-mono text-xs leading-relaxed">
        {logs.length === 0 ? (
          <p className="text-base-content/50">No log entries yet.</p>
        ) : (
          logs.map((entry) => (
            <div key={entry.id} className="flex gap-3">
              <span className="shrink-0 text-base-content/40">[{entry.time}]</span>
              <span className={levelClass[entry.level] ?? "text-base-content/70"}>
                {entry.message}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
