import { useEffect, useRef, useState } from "react";
import Header from "./Header";
import SiteSelect from "./SiteSelect";
import InstallerStatus from "./InstallerStatus";
import InstallButton from "./InstallButton";
import LogPanel from "./LogPanel";
import ErrorPanel from "./ErrorPanel";
import ConfirmDialog from "./ConfirmDialog";
import { useInstaller } from "../state/installerStore";
import {
  fitWindowHeight,
  restoreIfMaximized,
  toggleMaximizeWindow,
  watchFocused,
  watchMaximized,
} from "../lib/tauri";

/**
 * Top-level layout: header, site/status column, log panel, action row, and footer.
 *
 * Also owns the native-window behaviour: it grows the window if the content outgrows it (never shrinks),
 * blocks drag-to-unmaximize while maximized, and handles the F11 / Esc shortcuts.
 *
 * The Site + Status column sets the row height; the log panel is absolutely positioned
 * in its cell (large screens) so it stretches to exactly that height.
 *
 * The root fills the window height and the footer uses `mt-auto`, so it stays at the bottom.
 *
 * @returns The page layout.
 */
export default function AppShell() {
  const { phase } = useInstaller();
  const rootRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [focused, setFocused] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);

  //=-- Track window focus to draw the active-window border.
  useEffect(() => {
    let cancelled = false;
    let unwatch: () => void = () => {};
    void watchFocused(setFocused).then((un) => {
      if (cancelled) un();
      else unwatch = un;
    });
    return () => {
      cancelled = true;
      unwatch();
    };
  }, []);

  //=-- Give the sticky header bar a background only once content scrolls under it; at rest it is
  //=-- transparent so it does not draw a hard edge across the page gradient.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  //=-- Keep the native window exactly as tall as the content (re-fits as the log grows or text wraps).
  //=-- The root is min-h-screen so the footer sticks to the bottom; that is safe because fitting only grows.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const fit = () => void fitWindowHeight(el.getBoundingClientRect().height);
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    fit();
    return () => observer.disconnect();
  }, []);

  //=-- While maximized, dragging a background area must not un-maximize the window (Windows does
  //=-- that for native drags). Tauri starts the drag from a `document` mousedown listener, so a
  //=-- capture listener on `window` can stop it first. Double-click still toggles maximize.
  useEffect(() => {
    let maximized = false;
    let cancelled = false;
    let unwatch: () => void = () => {};

    void watchMaximized((m) => {
      maximized = m;
      setIsMaximized(m);
    }).then((un) => {
      if (cancelled) un();
      else unwatch = un;
    });

    /**
     * Stops drag-region mouse-downs while maximized (so Windows cannot un-maximize the
     * window by dragging) and turns a double-click into a maximize toggle.
     *
     * @param e - The captured mouse event.
     */
    const onMouseDown = (e: MouseEvent) => {
      if (!maximized || e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (!target?.hasAttribute?.("data-tauri-drag-region")) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.detail === 2) void toggleMaximizeWindow();
    };
    window.addEventListener("mousedown", onMouseDown, true);

    return () => {
      cancelled = true;
      unwatch();
      window.removeEventListener("mousedown", onMouseDown, true);
    };
  }, []);

  //=-- Keyboard shortcuts: F11 toggles maximize; Esc restores, but only while maximized.
  useEffect(() => {
    /**
     * F11 toggles maximize; Esc restores a maximized window (ignored inside the site dropdown).
     *
     * @param e - The keyboard event.
     */
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.defaultPrevented) return;
      if (e.key === "F11") {
        e.preventDefault();
        void toggleMaximizeWindow();
      } else if (e.key === "Escape") {
        //=-- The site dropdown calls preventDefault when Esc closes its list, so we return above.
        void restoreIfMaximized();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div ref={rootRef} data-tauri-drag-region className="flex min-h-screen flex-col px-4 pb-6 sm:px-8">
      {/*=-- Sticky full-width bar: the header (and window controls) stay on top while the page scrolls. */}
      <div
        data-tauri-drag-region
        className={`sticky top-0 z-40 -mx-4 mb-3 px-4 pb-3 pt-6 transition-[background-color,box-shadow] duration-200 sm:-mx-8 sm:px-8 ${
          scrolled ? "bg-base-100/95 shadow-lg shadow-black/40 backdrop-blur-md" : "bg-transparent"
        }`}
      >
        <Header fullWidth={isMaximized} maximized={isMaximized} />
      </div>

      {phase === "loading" ? (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-base-content/70">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p>Loading configuration...</p>
        </div>
      ) : (
        <>
          <ErrorPanel />

          <main data-tauri-drag-region className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <SiteSelect />
              <InstallerStatus />
            </div>
            <div className="relative">
              <div className="lg:absolute lg:inset-0">
                <LogPanel />
              </div>
            </div>
          </main>

          <div
            data-tauri-drag-region
            className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 pt-4 pb-4"
          >
            <div className="text-sm text-base-content/60">
              {phase === "ready" && "Select a site, then install."}
              {phase === "complete" && "Installation complete."}
              {phase === "failed" && "Review the error and log."}
              {(phase === "downloading" || phase === "verifying" || phase === "running") && "Please wait..."}
            </div>
            <InstallButton />
          </div>
        </>
      )}

      <ConfirmDialog />

      {/*=-- Subtle blurple frame while the window is focused (the window is frameless). Windows 11 rounds
          the corners of undecorated windows (8px), so the frame is rounded to match unless maximized. */}
      <div
        aria-hidden="true"
        style={isMaximized ? { inset: 1 } : undefined}
        className={`pointer-events-none fixed inset-0 z-[60] border border-primary/50 shadow-[inset_0_0_10px_rgba(124,58,237,0.15)] transition-opacity duration-150 ${
          isMaximized ? "" : "rounded-lg"
        } ${focused ? "opacity-100" : "opacity-0"}`}
      />

      <footer data-tauri-drag-region className="mx-auto mt-auto w-full max-w-6xl border-t border-base-300 pt-4 text-center text-xs text-base-content/50">
        By: Tyler Morrison (aka Imthatguyhere | ITGH)
      </footer>
    </div>
  );
}
