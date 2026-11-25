import { useEffect, useRef } from "react";
import Header from "./Header";
import SiteSelect from "./SiteSelect";
import InstallerStatus from "./InstallerStatus";
import InstallButton from "./InstallButton";
import LogPanel from "./LogPanel";
import ErrorPanel from "./ErrorPanel";
import { useInstaller } from "../state/installerStore";
import {
  fitWindowHeight,
  restoreIfMaximized,
  toggleMaximizeWindow,
  watchMaximized,
} from "../lib/tauri";

/**
 * Top-level layout: header, site/status column, log panel, action row, and footer.
 *
 * Also owns the native-window behaviour: it keeps the window as tall as the content,
 * blocks drag-to-unmaximize while maximized, and handles the F11 / Esc shortcuts.
 *
 * The Site + Status column sets the row height; the log panel is absolutely positioned
 * in its cell (large screens) so it stretches to exactly that height.
 *
 * @returns The page layout.
 */
export default function AppShell() {
  const { phase } = useInstaller();
  const rootRef = useRef<HTMLDivElement>(null);

  //=-- Keep the native window exactly as tall as the content (re-fits as the log grows or text wraps).
  //=-- The root must not stretch to the window height (no min-h-screen) or this would feed back.
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
    <div ref={rootRef} data-tauri-drag-region className="flex flex-col px-4 py-6 sm:px-8">
      <Header />

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
              {(phase === "downloading" || phase === "running") && "Please wait..."}
            </div>
            <InstallButton />
          </div>
        </>
      )}

      <footer data-tauri-drag-region className="mx-auto w-full max-w-6xl border-t border-base-300 pt-4 text-center text-xs text-base-content/50">
        By: Tyler Morrison (aka Imthatguyhere | ITGH)
      </footer>
    </div>
  );
}
