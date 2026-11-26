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
function OptionLabel({
  option,
}: {
  option: { label: string; shortName: string; displayName: string };
}) {
  if (!option.shortName)
    return <span className="truncate">{option.label}</span>;
  return (
    <>
      <ShortNameBadge name={option.shortName} />
      <span className="truncate">{option.displayName}</span>
    </>
  );
}

/**
 * Fuzzy subsequence score of `query` against `text` (case-insensitive).
 * Rewards prefix matches, word-start matches and consecutive runs; penalizes gaps.
 *
 * @param query - Lowercased query without surrounding whitespace.
 * @param text - Candidate text.
 * @returns A score (higher is better), or `null` when `query` is not a subsequence of `text`.
 */
function fuzzyScore(query: string, text: string): number | null {
  const t = text.toLowerCase();
  let score = 0;
  let pos = 0;
  let prev = -2;
  for (const ch of query) {
    const idx = t.indexOf(ch, pos);
    if (idx === -1) return null;
    score += 1;
    if (idx === prev + 1) score += 5;
    if (idx === 0) score += 8;
    else if (/[\s\-_.—]/.test(t[idx - 1])) score += 4;
    score -= Math.min(idx - pos, 5) * 0.2;
    prev = idx;
    pos = idx + 1;
  }
  //=-- Contiguous substring matches beat scattered subsequences.
  if (t.includes(query)) score += 10;
  return score;
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
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  //=-- Alphabetical by short name (case-insensitive, numeric-aware so "2X" sorts before "10X").
  const sortedSites = useMemo(
    () =>
      [...(config?.sites ?? [])].sort((a, b) =>
        a.shortName.localeCompare(b.shortName, undefined, {
          sensitivity: "base",
          numeric: true,
        }),
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

  //=-- Options shown in the list: everything when the query is empty, otherwise fuzzy matches best-first
  //=-- (short name weighted above the full label; ties keep alphabetical order).
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options
      .slice(1)
      .map((o) => {
        const a = fuzzyScore(q, o.shortName);
        const b = fuzzyScore(q, o.label);
        const score = Math.max(a === null ? -Infinity : a + 5, b ?? -Infinity);
        return { o, score };
      })
      .filter((r) => r.score > -Infinity)
      .sort((x, y) => y.score - x.score)
      .map((r) => r.o);
  }, [options, query]);

  //=-- Close when clicking outside the dropdown. Listens in the capture phase on `window` so drag
  //=-- regions (background, header) cannot swallow the event: `AppShell` stops propagation of
  //=-- drag-region mouse-downs while maximized, and Tauri's window drag takes over otherwise.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown, true);
    return () => window.removeEventListener("mousedown", onDown, true);
  }, [open]);

  //=-- Keep the highlighted option visible while navigating with the keyboard.
  useEffect(() => {
    if (!open) return;
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  //=-- Focus the search box when the list opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  /**
   * Opens the list with the current selection highlighted.
   *
   * @param initialQuery - Optional starting filter text (e.g. the key that opened the list).
   */
  const openList = (initialQuery = "") => {
    setQuery(initialQuery);
    setActive(initialQuery ? 0 : selectedIndex);
    setOpen(true);
  };

  /**
   * Closes the list and returns focus to the dropdown (the trigger, or its inline search input).
   */
  const closeList = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  /**
   * Commits an option and closes the list.
   *
   * @param index - Index into `visible`.
   */
  const choose = (index: number) => {
    const o = visible[index];
    if (!o) return;
    selectSite(o.id);
    closeList();
  };

  /**
   * Updates the filter text and resets the highlight to the best match.
   *
   * @param value - New query.
   */
  const onQueryChange = (value: string) => {
    setQuery(value);
    setActive(0);
  };

  /**
   * Keyboard handling for the dropdown (the trigger, or its inline search input).
   *
   * @param e - The keydown event.
   */
  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = visible.length - 1;
    const inInput = e.target === inputRef.current;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        e.preventDefault();
        if (!open) return openList();
        setActive((i) =>
          Math.min(last, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1))),
        );
        break;
      }
      case "Home":
      case "End":
        //=-- In the search box these move the text caret instead.
        if (!open || inInput) return;
        e.preventDefault();
        setActive(e.key === "Home" ? 0 : last);
        break;
      case "Enter":
        e.preventDefault();
        if (open) choose(active);
        else openList();
        break;
      case " ":
        //=-- In the search box space is typed text.
        if (inInput) return;
        e.preventDefault();
        if (open) choose(active);
        else openList();
        break;
      case "Escape":
        //=-- Closing the list is handled here; preventDefault keeps AppShell from also restoring the window.
        if (open) {
          e.preventDefault();
          closeList();
        }
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        //=-- Typing on the closed button opens the list pre-filtered.
        if (
          !open &&
          e.key.length === 1 &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey
        ) {
          e.preventDefault();
          openList(e.key);
        }
    }
  };

  return (
    <section className="glow-panel card relative z-20 rounded-box p-5">
      <h2 className="mb-3 text-lg font-semibold">Site</h2>

      <div ref={rootRef} className="relative">
        <div
          ref={buttonRef}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          tabIndex={open ? -1 : 0}
          onClick={(e) => {
            //=-- Clicks inside the search input just position the caret; anywhere else toggles the list.
            if (e.target === inputRef.current) return;
            if (open) closeList();
            else openList();
          }}
          onKeyDown={onKeyDown}
          className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-field border bg-base-200/70 px-3 py-2 text-left outline-none transition ${
            open
              ? "border-primary shadow-[0_0_0_3px_rgba(124,58,237,0.25)]"
              : "border-primary/30 hover:border-primary/60 focus-visible:border-primary"
          }`}
        >
          {open ? (
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={options[selectedIndex].label}
              aria-label="Filter sites"
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-base-content/40"
            />
          ) : (
            <span
              className={`flex min-w-0 items-center gap-2 ${selectedSite ? "" : "text-base-content/50"}`}
            >
              <OptionLabel option={options[selectedIndex]} />
            </span>
          )}
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
        </div>

        {open && (
          <ul
            ref={listRef}
            role="listbox"
            className="absolute left-0 right-0 top-full z-30 mt-2 max-h-60 overflow-y-auto rounded-box border border-primary/40 bg-base-200/95 p-1.5 shadow-2xl shadow-black/60 ring-1 ring-secondary/20 backdrop-blur-md"
          >
            {visible.length === 0 && (
              <li className="px-3 py-2 text-sm text-base-content/50">
                No matching sites
              </li>
            )}
            {visible.map((o, i) => {
              const selected = o.id === (selectedSite?.id ?? "");
              return (
                <li
                  key={o.id || "__none"}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(i)}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-field px-3 py-2 text-sm transition-colors ${
                    i === active
                      ? "bg-primary/25 text-base-content"
                      : "text-base-content/85"
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
          <span className="text-base-content/60">Site ID</span>
          <span className="font-mono">{selectedSite?.id ?? "—"}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-base-content/60">Datto UID</span>
          <code className="font-mono text-accent">
            {selectedSite?.siteUid ?? "—"}
          </code>
        </div>
      </div>
    </section>
  );
}
