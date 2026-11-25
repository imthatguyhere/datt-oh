import { useEffect, useRef } from "react";
import { useInstaller } from "../state/installerStore";

/**
 * Text colour class for each log level.
 */
const levelClass: Record<string, string> = {
  info: "text-base-content/70",
  success: "text-success",
  error: "text-error",
};

/**
 * Scrollable, auto-following log of install progress. Its height is set by its parent
 * (it fills the cell it is placed in).
 *
 * @returns The log panel.
 */
export default function LogPanel() {
  const { logs } = useInstaller();
  const scrollRef = useRef<HTMLDivElement>(null);

  //=-- The panel has a fixed height (matching the Site + Status column), so follow new entries.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <section className="glow-panel card flex h-full w-full flex-col rounded-box p-5">
      <h2 className="mb-3 shrink-0 text-lg font-semibold">Log</h2>
      <div
        ref={scrollRef}
        className="max-h-96 min-h-32 flex-1 overflow-y-auto rounded-lg bg-base-200/50 p-3 font-mono text-xs leading-relaxed lg:max-h-none"
      >
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
