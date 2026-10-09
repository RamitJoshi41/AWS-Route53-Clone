"use client";

import Autosuggest, { type AutosuggestProps } from "@cloudscape-design/components/autosuggest";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { NAVIGATION, type NavLink } from "@/lib/navigation";
import { displayName, useZones } from "@/lib/zones";

import styles from "./ConsoleSearch.module.css";

// Option values are prefixed by kind, so a zone and a page can never collide.
const PAGE_PREFIX = "page:";
const ZONE_PREFIX = "zone:";

// Every side-navigation page, tagged with its section ("VPC Resolver", ...).
const PAGE_OPTIONS: AutosuggestProps.Option[] = NAVIGATION.flatMap((entry) => {
  if (entry === "divider") return [];
  const links: [NavLink, string | undefined][] =
    "section" in entry ? entry.links.map((link) => [link, entry.section]) : [[entry, undefined]];
  return links.map(([link, section]) => ({
    value: PAGE_PREFIX + link.href,
    label: link.text,
    tags: section ? [section] : undefined,
  }));
});

/**
 * The top bar's search box. The console's searches all of AWS; this one finds the
 * Route 53 pages and the user's hosted zones, and opens the chosen one.
 * Alt+S focuses it, as in the console.
 */
export default function ConsoleSearch() {
  const router = useRouter();
  const ref = useRef<AutosuggestProps.Ref>(null);
  const [value, setValue] = useState("");
  // The zone list is only fetched once the box is used (it's usually cached anyway).
  const [used, setUsed] = useState(false);
  const zones = useZones({ enabled: used });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.code === "KeyS") {
        event.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const options = useMemo<AutosuggestProps.Options>(
    () => [
      { label: "Features", options: PAGE_OPTIONS },
      {
        label: "Hosted zones",
        options: (zones.data ?? []).map((zone) => ({
          value: ZONE_PREFIX + zone.id,
          label: displayName(zone.name),
          description: zone.id,
          labelTag: zone.type === "public" ? "Public" : "Private",
        })),
      },
    ],
    [zones.data],
  );

  const open = (selected: string) => {
    setValue("");
    if (selected.startsWith(PAGE_PREFIX)) router.push(selected.slice(PAGE_PREFIX.length));
    else if (selected.startsWith(ZONE_PREFIX))
      router.push(`/hosted-zones/${encodeURIComponent(selected.slice(ZONE_PREFIX.length))}`);
  };

  return (
    <div className={styles.search}>
      <Autosuggest
        ref={ref}
        value={value}
        onChange={({ detail }) => setValue(detail.value)}
        onFocus={() => setUsed(true)}
        onSelect={({ detail }) => open(detail.value)}
        options={options}
        filteringType="auto"
        hideEnteredTextOption
        placeholder="Search"
        ariaLabel="Search Route 53 pages and hosted zones"
        statusType={zones.isPending && used ? "loading" : zones.isError ? "error" : "finished"}
        loadingText="Loading hosted zones"
        errorText="Hosted zones couldn't be loaded."
        empty="No matches"
      />
      {value === "" && (
        <span className={styles.hint} aria-hidden="true">
          [Alt+S]
        </span>
      )}
    </div>
  );
}
