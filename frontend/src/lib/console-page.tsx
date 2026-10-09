"use client";

// Per-page settings for the console shell. The shell (AppLayoutToolbar) lives in
// the (console) layout and stays mounted while you navigate. Each page tells it
// its breadcrumbs, content type and split panel by calling useConsolePage().

import type { AppLayoutProps } from "@cloudscape-design/components/app-layout";
import type { BreadcrumbGroupProps } from "@cloudscape-design/components/breadcrumb-group";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import type { HelpTopic } from "@/lib/helpTopics";

export type ConsolePageConfig = {
  /** Without the leading "Route 53" crumb, which the shell adds. */
  breadcrumbs: BreadcrumbGroupProps.Item[];
  /** "form" pages (create/edit) open with the side navigation closed, as in the console. */
  contentType?: AppLayoutProps.ContentType;
  /** The right-hand split panel, if the page has one. */
  splitPanel?: ConsoleSplitPanel;
  /** Caps the content's width (centred), for pages the console shows as a narrower column. */
  maxContentWidth?: number;
  /** What the help panel shows until an Info link picks a topic. Without one, there's no help panel. */
  helpTopic?: HelpTopic;
};

export type ConsoleSplitPanel = {
  /** Identifies the panel, so a size the user drags it to is remembered for that page. */
  id: string;
  /** Width in pixels when it first opens on the side (the console's default for that page). */
  defaultSize: number;
  /** A <SplitPanel> element. */
  content: ReactNode;
};

const EMPTY_PAGE: ConsolePageConfig = { breadcrumbs: [] };

const SetPageContext = createContext<Dispatch<SetStateAction<ConsolePageConfig>> | null>(null);
const PageContext = createContext<ConsolePageConfig>(EMPTY_PAGE);

export function ConsolePageProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<ConsolePageConfig>(EMPTY_PAGE);
  // The setter context never changes, so pages calling useConsolePage() aren't
  // re-rendered when the config changes; only the shell (which reads it) is.
  return (
    <SetPageContext.Provider value={setPage}>
      <PageContext.Provider value={page}>{children}</PageContext.Provider>
    </SetPageContext.Provider>
  );
}

/** For pages: registers this page's settings with the shell while it's shown. */
export function useConsolePage(config: ConsolePageConfig): void {
  const setPage = useContext(SetPageContext);
  if (!setPage) throw new Error("useConsolePage must be used inside <ConsolePageProvider>");

  const { breadcrumbs, contentType, splitPanel, maxContentWidth, helpTopic } = config;
  // Breadcrumbs arrive as a new array on every render; compare them by content.
  const breadcrumbsKey = JSON.stringify(breadcrumbs);

  useEffect(() => {
    setPage({ breadcrumbs: JSON.parse(breadcrumbsKey), contentType, splitPanel, maxContentWidth, helpTopic });
  }, [setPage, breadcrumbsKey, contentType, splitPanel, maxContentWidth, helpTopic]);

  // Leaving the page clears its settings, so nothing leaks into the next page.
  useEffect(() => () => setPage(EMPTY_PAGE), [setPage]);
}

/** For the shell: the current page's settings. */
export function useCurrentConsolePage(): ConsolePageConfig {
  return useContext(PageContext);
}
