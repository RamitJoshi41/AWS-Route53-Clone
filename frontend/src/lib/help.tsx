"use client";

// State of the help panel (AppLayout's "tools" drawer): whether it's open and which
// topic it shows. "Info" links open it on their topic; otherwise it shows the page's
// default topic (ConsolePageConfig.helpTopic). The shell renders the panel.

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import type { HelpTopic } from "@/lib/helpTopics";

type HelpState = {
  open: boolean;
  /** The topic an Info link chose on this page; null means the page's default. */
  topic: HelpTopic | null;
  /** Increases on every Info click, so the shell can move focus into the panel. */
  focusRequest: number;
  openTopic: (topic: HelpTopic) => void;
  setOpen: (open: boolean) => void;
};

const HelpContext = createContext<HelpState | null>(null);

export function HelpProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<HelpTopic | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);

  // A new page starts on its own default topic; the panel stays open or closed.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setTopic(null);
  }

  const openTopic = useCallback((next: HelpTopic) => {
    setTopic(next);
    setOpen(true);
    setFocusRequest((count) => count + 1);
  }, []);

  const value = useMemo(
    () => ({ open, topic, focusRequest, openTopic, setOpen }),
    [open, topic, focusRequest, openTopic],
  );
  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
}

export function useHelp(): HelpState {
  const help = useContext(HelpContext);
  if (!help) throw new Error("useHelp must be used inside <HelpProvider>");
  return help;
}
