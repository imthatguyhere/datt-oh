import { closeWindow, minimizeWindow, toggleMaximizeWindow } from "../lib/tauri";

interface ControlProps {
  label: string;
  color: string;
  glyph: string;
  onClick: () => void;
}

//=-- One traffic-light button: a coloured circle whose glyph appears on hover.
function Control({ label, color, glyph, onClick }: ControlProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`group flex h-3.5 w-3.5 items-center justify-center rounded-full ${color} transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
    >
      <span className="text-[10px] leading-none font-bold text-black/60 opacity-0 transition-opacity group-hover:opacity-100">
        {glyph}
      </span>
    </button>
  );
}

//=-- Custom window controls (the native title bar is disabled). Right-aligned order,
//=-- left to right: maximize (green), minimize (yellow), close (red).
export default function WindowControls() {
  return (
    <div className="flex items-center gap-2">
      <Control label="Maximize" color="bg-[#28c840]" glyph="+" onClick={toggleMaximizeWindow} />
      <Control label="Minimize" color="bg-[#febc2e]" glyph="–" onClick={minimizeWindow} />
      <Control label="Close" color="bg-[#ff5f57]" glyph="×" onClick={closeWindow} />
    </div>
  );
}
