"use client";

import Button from "@cloudscape-design/components/button";
import Input, { type InputProps } from "@cloudscape-design/components/input";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";

import ComingSoonPopover from "@/components/ComingSoonPopover";
import type { HostedZone } from "@/lib/api";
import { NAVIGATION, type NavLink } from "@/lib/navigation";
import { displayName, useZones } from "@/lib/zones";

import styles from "./ConsoleSearch.module.css";

type Result = { id: string; href: string; title: string; detail: string; feature?: boolean };
type SectionId = "features" | "zones";
type Section = { id: SectionId; title: string; results: Result[]; status?: "loading" | "error" };

// The main view shows the first few results of each section; "Show more" lists all.
const SECTION_PREVIEW = 3;

// Every side-navigation page with the nav section it sits in ("VPC Resolver", ...).
type Page = [link: NavLink, section: string | undefined];
const PAGES: Page[] = NAVIGATION.flatMap((entry): Page[] => {
  if (entry === "divider") return [];
  if ("section" in entry) return entry.links.map((link): Page => [link, entry.section]);
  return [[entry, undefined]];
});

function search(query: string, zones: HostedZone[] | undefined, zonesStatus?: Section["status"]): Section[] {
  const q = query.trim().toLowerCase();
  const features = PAGES.filter(
    ([link, section]) => link.text.toLowerCase().includes(q) || section?.toLowerCase().includes(q),
  ).map(([link]) => ({
    id: `page-${link.href}`,
    href: link.href,
    title: link.text,
    detail: "Route 53 feature",
    feature: true,
  }));
  const hostedZones = (zones ?? [])
    .filter((zone) => displayName(zone.name).includes(q) || zone.id.toLowerCase().includes(q))
    .map((zone) => ({
      id: `zone-${zone.id}`,
      href: `/hosted-zones/${encodeURIComponent(zone.id)}`,
      title: displayName(zone.name),
      detail: `${zone.type === "public" ? "Public" : "Private"} hosted zone · ${zone.id}`,
    }));
  return [
    { id: "features" as const, title: "Features", results: features },
    { id: "zones" as const, title: "Hosted zones", results: hostedZones, status: zonesStatus },
  ].filter((section) => section.results.length > 0 || section.status);
}

/**
 * The top bar's search, laid out like the console's (screenshots Console Search,
 * knowledge_SHow_more, Search_No_Results): typing opens a dark panel under the bar
 * with a category list and result cards per section, "Show more" lists a whole
 * section. The console searches all of AWS; this one finds the Route 53 pages and
 * the user's hosted zones. Alt+S focuses it; arrow keys move a blue highlight over
 * the cards and Enter opens one; Escape closes the panel.
 */
export default function ConsoleSearch() {
  const router = useRouter();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<InputProps.Ref>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false); // closed with Escape until the next keystroke
  const [expanded, setExpanded] = useState<SectionId | null>(null); // "Show more" view
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);
  const [highlighted, setHighlighted] = useState(-1);
  const [maxWidth, setMaxWidth] = useState<number>();

  // Zones are fetched once the box is first used (and usually cached by then anyway).
  const [used, setUsed] = useState(false);
  const zones = useZones({ enabled: used });

  const query = value.trim();
  const open = focused && !dismissed && query !== "";
  const zonesStatus = zones.isError ? "error" : zones.data ? undefined : "loading";
  const sections = useMemo(() => search(query, zones.data, zonesStatus), [query, zones.data, zonesStatus]);
  const expandedSection = sections.find((section) => section.id === expanded);
  // The cards the arrow keys move through, in display order.
  const visible = expandedSection
    ? expandedSection.results
    : sections.flatMap((section) => section.results.slice(0, SECTION_PREVIEW));
  const highlightedResult = visible[highlighted];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.code === "KeyS") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (highlightedResult) document.getElementById(optionId(panelId, highlightedResult))?.scrollIntoView({ block: "nearest" });
  }, [highlightedResult, panelId]);

  const changeQuery = (next: string) => {
    setValue(next);
    setDismissed(false);
    setExpanded(null);
    setActiveSection(null);
    setHighlighted(-1);
    // The panel starts under the search box and must stay inside the window.
    const left = rootRef.current?.getBoundingClientRect().left ?? 0;
    setMaxWidth(window.innerWidth - left - 16);
  };

  const showSection = (id: SectionId | null) => {
    setExpanded(id);
    setHighlighted(-1);
    resultsRef.current?.scrollTo({ top: 0 });
    // The button that was used disappears with the view; keep the keyboard in the box.
    inputRef.current?.focus();
  };

  // After choosing a result: clear the box (which closes the panel). The focus
  // stays in the box, so typing again searches again.
  const reset = () => changeQuery("");

  const go = (result: Result) => {
    reset();
    router.push(result.href);
  };

  const onKeyDown = (event: CustomEvent<InputProps.KeyDetail>) => {
    if (!open) return;
    if (event.detail.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((index) => Math.min(index + 1, visible.length - 1));
    } else if (event.detail.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((index) => Math.max(index - 1, -1));
    } else if (event.detail.key === "Enter") {
      // With nothing highlighted, Enter opens the first result.
      const result = highlightedResult ?? visible[0];
      if (result) go(result);
    }
  };

  const card = (result: Result, index: number) => (
    <li key={result.id}>
      <Link
        id={optionId(panelId, result)}
        href={result.href}
        role="option"
        aria-selected={index === highlighted}
        className={styles.card}
        data-highlighted={index === highlighted || undefined}
        onMouseEnter={() => setHighlighted(index)}
        onClick={(event) => {
          // Plain clicks go the same way as Enter; modified clicks (new tab) stay native.
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          go(result);
        }}
        tabIndex={-1}
      >
        <span className={styles.cardTitle}>{result.title}</span>
        <span className={styles.cardDetail}>
          {result.feature && <span className={styles.featureMark} aria-hidden="true" />}
          {result.detail}
        </span>
      </Link>
    </li>
  );

  // Running index into `visible` while rendering the main view's sections.
  let cardIndex = 0;

  return (
    <div
      ref={rootRef}
      className={styles.root}
      onFocus={() => {
        setFocused(true);
        setUsed(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setDismissed(true);
          inputRef.current?.focus();
        }
      }}
    >
      <Input
        ref={inputRef}
        type="search"
        value={value}
        onChange={({ detail }) => changeQuery(detail.value)}
        onKeyDown={onKeyDown}
        placeholder="Search"
        ariaLabel="Search Route 53 pages and hosted zones"
        clearAriaLabel="Clear search"
        autoComplete={false}
        nativeInputAttributes={{
          role: "combobox",
          "aria-expanded": open,
          "aria-controls": panelId,
          "aria-autocomplete": "list",
          "aria-activedescendant": open && highlightedResult ? optionId(panelId, highlightedResult) : undefined,
        }}
      />
      {value === "" && (
        <span className={styles.hint} aria-hidden="true">
          [Alt+S]
        </span>
      )}

      {open && (
        <div
          id={panelId}
          className={styles.panel}
          style={{ maxWidth } as CSSProperties}
          // Clicks inside keep the focus in the search box, so the panel stays open
          // and the arrow keys keep working.
          onMouseDown={(event) => event.preventDefault()}
        >
          {sections.length === 0 ? (
            <div className={styles.noResults}>
              <p className={styles.noResultsText}>No results match &apos;{query}&apos;. Try a different term.</p>
              <ComingSoonPopover feature="Search feedback">
                <Button>Looking for something else? Let us know</Button>
              </ComingSoonPopover>
            </div>
          ) : expandedSection ? (
            <div ref={resultsRef} className={styles.results}>
              <p className={styles.caption}>Search results for &apos;{query}&apos;</p>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  {expandedSection.title} results for &apos;{query}&apos;
                </h2>
                <button type="button" className={styles.textButton} onClick={() => showSection(null)}>
                  Back
                </button>
              </div>
              <ul className={styles.cards} role="listbox" aria-label={expandedSection.title}>
                {expandedSection.results.map(card)}
              </ul>
            </div>
          ) : (
            <div className={styles.columns}>
              <ul className={styles.categories} aria-label="Result categories">
                {sections.map((section) => (
                  <li key={section.id}>
                    <button
                      type="button"
                      className={styles.category}
                      aria-current={(activeSection ?? sections[0].id) === section.id || undefined}
                      onClick={() => {
                        setActiveSection(section.id);
                        document.getElementById(`${panelId}-${section.id}`)?.scrollIntoView({ block: "start" });
                      }}
                    >
                      {section.title}
                    </button>
                  </li>
                ))}
              </ul>
              <div ref={resultsRef} className={styles.results}>
                {sections.map((section) => (
                  <section key={section.id} id={`${panelId}-${section.id}`} className={styles.section}>
                    <div className={styles.sectionHeader}>
                      <h2 className={styles.sectionTitle}>{section.title}</h2>
                      {section.results.length > SECTION_PREVIEW && (
                        <button type="button" className={styles.textButton} onClick={() => showSection(section.id)}>
                          Show more
                        </button>
                      )}
                    </div>
                    {section.status === "loading" ? (
                      <StatusIndicator type="loading">Loading hosted zones</StatusIndicator>
                    ) : section.status === "error" ? (
                      <StatusIndicator type="error">Hosted zones couldn&apos;t be loaded.</StatusIndicator>
                    ) : (
                      <ul className={styles.cards} role="listbox" aria-label={section.title}>
                        {section.results.slice(0, SECTION_PREVIEW).map((result) => card(result, cardIndex++))}
                      </ul>
                    )}
                  </section>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function optionId(panelId: string, result: Result): string {
  return `${panelId}-${result.id}`;
}
