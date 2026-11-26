import { useEffect, useRef } from "react";
import { useInstaller } from "../state/installerStore";

/**
 * Modal yes/no dialog driven by the installer store's `confirm` request. Renders nothing when
 * there is no open question. Focus starts on the "No" button (the safe default); Esc answers no.
 *
 * @returns The dialog overlay, or `null`.
 */
export default function ConfirmDialog() {
  const { confirm, answerConfirm } = useInstaller();
  const cancelRef = useRef<HTMLButtonElement>(null);

  //=-- Move focus into the dialog when it opens.
  useEffect(() => {
    if (confirm) cancelRef.current?.focus();
  }, [confirm]);

  if (!confirm) return null;

  /**
   * Esc answers no; Tab is kept inside the dialog. preventDefault on Esc keeps AppShell from also
   * restoring the window.
   *
   * @param e - The keydown event.
   */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      answerConfirm(false);
    } else if (e.key === "Tab") {
      const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>("button");
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onKeyDown={onKeyDown}
        className="glow-panel card max-h-full w-full max-w-lg overflow-y-auto rounded-box border border-primary/40 bg-base-200 p-5 shadow-2xl"
      >
        <h2 id="confirm-title" className="text-lg font-semibold">
          {confirm.title}
        </h2>
        <p id="confirm-message" className="mt-2 text-sm text-base-content/80">
          {confirm.message}
        </p>

        {confirm.warnings && confirm.warnings.length > 0 && (
          <ul className="mt-3 space-y-1 rounded-field border border-warning/50 bg-warning/10 p-3 text-sm text-warning">
            {confirm.warnings.map((w) => (
              <li key={w}>⚠ {w}</li>
            ))}
          </ul>
        )}

        {confirm.details && (
          <dl className="mt-3 space-y-1 text-sm">
            {confirm.details.map((d) => (
              <div key={d.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <dt className="shrink-0 text-base-content/60 sm:w-24">{d.label}</dt>
                <dd className="min-w-0 break-all font-mono text-xs text-accent">{d.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-ghost"
            onClick={() => answerConfirm(false)}
          >
            {confirm.cancelLabel}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => answerConfirm(true)}>
            {confirm.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
