import type { ReactNode } from "react";
import { closeWindow, minimizeWindow, toggleMaximizeWindow } from "../lib/tauri";

/**
 * Props for a single traffic-light button.
 */
interface ControlProps {
  label: string;
  color: string;
  glyph: ReactNode;
  onClick: () => void;
}

/**
 * One traffic-light button: a coloured circle whose glyph appears on hover.
 *
 * @param props - Accessible label, colour class, hover glyph and click handler.
 * @returns The button.
 */
function Control({ label, color, glyph, onClick }: ControlProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`group flex h-3.5 w-3.5 items-center justify-center rounded-full ${color} transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
    >
      {/*=-- Text glyphs (+, –, ×) sit low and left of true centre in the font, so nudge them up/right; the SVG caret is already centred. */}
      <span
        className={`text-[10px] leading-none font-bold text-black/60 opacity-0 transition-opacity group-hover:opacity-100 ${
          typeof glyph === "string" ? "-translate-y-px translate-x-[0.5px]" : ""
        }`}
      >
        {glyph}
      </span>
    </button>
  );
}

/**
 * Down-pointing caret glyph for the minimize button.
 *
 * @returns The caret icon.
 */
function CaretDown() {
  return (
    <svg
      viewBox="0 0 10 10"
      className="size-[6.75px] translate-y-px"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1.5 3l3.5 3.5L8.5 3" />
    </svg>
  );
}

/**
 * Custom window controls (the native title bar is disabled). Left to right: maximize/restore
 * (green; hover shows "+" to maximize, "-" to restore), minimize (yellow; hover shows a down
 * caret), close (red).
 *
 * @param props.maximized - Whether the window is currently maximized.
 * @returns The control group.
 */
export default function WindowControls({ maximized }: { maximized: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Control
        label={maximized ? "Restore" : "Maximize"}
        color="bg-[#28c840]"
        glyph={maximized ? "–" : "+"}
        onClick={toggleMaximizeWindow}
      />
      <Control label="Minimize" color="bg-[#febc2e]" glyph={<CaretDown />} onClick={minimizeWindow} />
      <Control label="Close" color="bg-[#ff5f57]" glyph="×" onClick={closeWindow} />
    </div>
  );
}
