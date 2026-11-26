import { useEffect, useRef, useState } from "react";

/**
 * Small icon button that copies text to the clipboard and briefly shows a check mark.
 *
 * @param props.text - The text to copy. The button is disabled while this is empty.
 * @param props.label - Accessible label / tooltip, e.g. "Copy Site ID".
 * @param props.className - Extra classes (e.g. absolute positioning).
 * @returns The button.
 */
export default function CopyButton({
  text,
  label,
  className = "",
}: {
  text: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  /**
   * Writes the text to the clipboard and flashes the confirmation state.
   */
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1200);
    } catch {
      //=-- Clipboard unavailable or denied; nothing useful to show.
    }
  };

  return (
    <button
      type="button"
      aria-label={label}
      title={copied ? "Copied!" : label}
      disabled={!text}
      onClick={() => void copy()}
      className={`inline-flex size-6 shrink-0 items-center justify-center rounded-md text-base-content/50 transition-colors hover:bg-base-300/60 hover:text-base-content focus-visible:outline-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-30 ${
        copied ? "text-success hover:text-success" : ""
      } ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {copied ? (
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        ) : (
          <>
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V6a2 2 0 0 1 2-2h9" />
          </>
        )}
      </svg>
    </button>
  );
}
