import { useEffect, useMemo, useRef, useState } from "react";
import { badgeStyle } from "../lib/badgeColor";
import { useInstaller } from "../state/installerStore";

/**
 * A short name rendered as a badge whose color is derived from the name itself.
 *
 * @param props.name - The site short name.
 * @returns The badge.
 */
function ShortNameBadge({ name }: { name: string }) {
  return (
    <span
      className="inline-block shrink-0 rounded-md border px-2 py-0.5 font-mono text-xs font-semibold leading-tight"
      style={badgeStyle(name)}
    >
      {name}
    </span>
  );
}

/**
 * Dropdown row content: a short-name badge followed by the full name, or the plain placeholder.
 *
 * @param props.option - The option to render (an empty `shortName` means the placeholder).
 * @returns The label content.
 */
function OptionLabel({ option }: { option: { label: string; shortName: string; displayName: string } }) {
  if (!option.shortName) return <span className="truncate">{option.label}</span>;
  return (
    <>
      <ShortNameBadge name={option.shortName} />
      <span className="truncate">{option.displayName}</span>
    </>
  );
}

/**
 * Site picker card: a themed dropdown sorted alphabetically by short name (shown as
 * "SHORT — Full name") below a "----------" placeholder, and details for the selected site.
 * Always rendered, so the placeholder shows even when no config loaded.
 *
 * The list is a custom listbox rather than a native `<select>`, because the native popup is drawn
 * by the OS and cannot be themed. It supports click, arrow keys, Home/End, Enter/Space and Esc.
 *
 * @returns The site selection card.
 */
export default function SiteSelect() {
  const { config, selectedSite, selectSite } = useInstaller();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  //=-- Alphabetical by short name (case-insensitive, numeric-aware so "2X" sorts before "10X").
  const sortedSites = useMemo(
    () =>
      [...(config?.sites ?? [])].sort((a, b) =>
        a.shortName.localeCompare(b.shortName, undefined, { sensitivity: "base", numeric: true }),
      ),
    [config],
  );

  //=-- Option 0 is the placeholder (empty id); the rest are the sorted sites.
  const options = useMemo(
    () => [
      { id: "", label: "----------", shortName: "", displayName: "" },
      ...sortedSites.map((s) => ({
        id: s.id,
        label: `${s.shortName} — ${s.displayName}`,
        shortName: s.shortName,
        displayName: s.displayName,
      })),
    ],
    [sortedSites],
  );

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.id === (selectedSite?.id ?? "")),
  );

  //=-- Close when clicking outside the dropdown.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  //=-- Keep the highlighted option visible while navigating with the keyboard.
  useEffect(() => {
    if (!open) return;
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  /** Opens the list with the current selection highlighted. */
  const openList = () => {
    setActive(selectedIndex);
    setOpen(true);
  };

  /**
   * Commits an option and closes the list.
   *
   * @param index - Index into `options`.
   */
  const choose = (index: number) => {
    selectSite(options[index].id);
    setOpen(false);
  };

  /**
   * Keyboard handling for the dropdown button.
   *
   * @param e - The keydown event.
   */
  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = options.length - 1;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        e.preventDefault();
        if (!open) return openList();
        setActive((i) => Math.min(last, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1))));
        break;
      }
      case "Home":
      case "End":
        if (!open) return;
        e.preventDefault();
        setActive(e.key === "Home" ? 0 : last);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (open) choose(active);
        else openList();
        break;
      case "Escape":
        //=-- Closing the list is handled here; preventDefault keeps AppShell from also restoring the window.
        if (open) {
          e.preventDefault();
          setOpen(false);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <section className="glow-panel card relative z-20 rounded-box p-5">
      <h2 className="mb-3 text-lg font-semibold">Site</h2>

      <div ref={rootRef} className="relative">
        <button
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => (open ? setOpen(false) : openList())}
          onKeyDown={onKeyDown}
          className={`flex w-full items-center justify-between gap-3 rounded-field border bg-base-200/70 px-3 py-2 text-left outline-none transition ${
            open
              ? "border-primary shadow-[0_0_0_3px_rgba(124,58,237,0.25)]"
              : "border-primary/30 hover:border-primary/60 focus-visible:border-primary"
          }`}
        >
          <span className={`flex min-w-0 items-center gap-2 ${selectedSite ? "" : "text-base-content/50"}`}>
            <OptionLabel option={options[selectedIndex]} />
          </span>
          <svg
            viewBox="0 0 20 20"
            className={`size-4 shrink-0 text-primary transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 8l5 5 5-5" />
          </svg>
        </button>

        {open && (
          <ul
            ref={listRef}
            role="listbox"
            className="absolute left-0 right-0 top-full z-30 mt-2 max-h-60 overflow-y-auto rounded-box border border-primary/40 bg-base-200/95 p-1.5 shadow-2xl shadow-black/60 ring-1 ring-secondary/20 backdrop-blur-md"
          >
            {options.map((o, i) => {
              const selected = i === selectedIndex;
              return (
                <li
                  key={o.id || "__none"}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(i)}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-field px-3 py-2 text-sm transition-colors ${
                    i === active ? "bg-primary/25 text-base-content" : "text-base-content/85"
                  } ${o.id === "" ? "text-base-content/50" : ""}`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <OptionLabel option={o} />
                  </span>
                  {selected && (
                    <span className="size-2 shrink-0 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/*=-- Always shown; falls back to a dash when no site is selected. */}
      <div className="mt-4 space-y-1 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-base-content/60">Short name</span>
          {selectedSite ? <ShortNameBadge name={selectedSite.shortName} /> : <span className="font-mono">—</span>}
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-base-content/60">Site UID</span>
          <code className="font-mono text-accent">{selectedSite?.siteUid ?? "—"}</code>
        </div>
      </div>
    </section>
  );
}
