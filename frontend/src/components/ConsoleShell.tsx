"use client";

import type { AppLayoutProps } from "@cloudscape-design/components/app-layout";
import AppLayoutToolbar, { type AppLayoutToolbarProps } from "@cloudscape-design/components/app-layout-toolbar";
import Box from "@cloudscape-design/components/box";
import BreadcrumbGroup from "@cloudscape-design/components/breadcrumb-group";
import Flashbar from "@cloudscape-design/components/flashbar";
import Popover from "@cloudscape-design/components/popover";
import SideNavigation, { type SideNavigationProps } from "@cloudscape-design/components/side-navigation";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import ConsoleFooter from "@/components/ConsoleFooter";
import ConsoleTopNav from "@/components/ConsoleTopNav";
import HelpTopicPanel from "@/components/HelpTopicPanel";
import { useCurrentConsolePage } from "@/lib/console-page";
import { useHelp } from "@/lib/help";
import { NAVIGATION, type NavLink } from "@/lib/navigation";
import { useNotificationMessages } from "@/lib/notifications";

const HEADER_ID = "console-header";
const FOOTER_ID = "console-footer";
const DEFAULT_SPLIT_PANEL_SIZE = 412;
// Cloudscape's mobile breakpoint: below it AppLayout switches to its mobile layout.
const MOBILE_MAX_WIDTH = 688;

// The blue "New" label next to some nav links; clicking it opens a short popover.
function NewLabel({ header, content }: { header: string; content: string }) {
  return (
    <Popover triggerType="text" size="medium" position="right" header={header} content={content}>
      <Box variant="small" color="text-status-info" fontWeight="bold">
        New
      </Box>
    </Popover>
  );
}

function toNavLink(link: NavLink): SideNavigationProps.Link {
  return {
    type: "link",
    text: link.text,
    href: link.href,
    external: link.external,
    info: link.newLabel ? <NewLabel {...link.newLabel} /> : undefined,
  };
}

const NAV_ITEMS: SideNavigationProps.Item[] = NAVIGATION.map((entry): SideNavigationProps.Item => {
  if (entry === "divider") return { type: "divider" };
  if ("section" in entry) {
    return { type: "section", text: entry.section, defaultExpanded: true, items: entry.links.map(toNavLink) };
  }
  return toNavLink(entry);
});

/**
 * The console frame around every signed-in page: the dark top bar, then
 * Cloudscape's AppLayoutToolbar with the Route 53 side navigation, the breadcrumb
 * bar, flash messages and (if the page has one) the split panel, then the dark
 * bottom bar. The header and footer selectors tell AppLayout how much of the
 * window those two bars take, so its sticky parts (navigation, panels) fit between.
 */
export default function ConsoleShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const page = useCurrentConsolePage();
  const notifications = useNotificationMessages();
  const help = useHelp();
  const helpTopic = help.topic ?? page.helpTopic;
  const appLayoutRef = useRef<AppLayoutToolbarProps.Ref>(null);

  // After an Info link opened the panel, move keyboard focus into it (Cloudscape's
  // recommendation), so screen-reader and keyboard users land on the new content.
  useEffect(() => {
    if (help.focusRequest === 0) return;
    // One frame later: the panel's new content has rendered by then.
    const frame = requestAnimationFrame(() => appLayoutRef.current?.focusToolsClose());
    return () => cancelAnimationFrame(frame);
  }, [help.focusRequest]);

  // The nav stays as the user left it on normal pages; form pages (create/edit)
  // always open with it closed, as in the console.
  const [navigationOpen, setNavigationOpen] = useState(true);
  const [formNavigationOpen, setFormNavigationOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    // Adjusting state during render on a route change (React's recommended
    // alternative to an effect): each form page starts with the nav closed.
    setLastPathname(pathname);
    setFormNavigationOpen(false);
  }
  const isForm = page.contentType === "form";

  // Open on the side by default, as in the console; its gear lets the user move it.
  // On phones AppLayout moves the panel to the bottom, where an open panel would
  // cover the page, so it starts closed there. (The shell only renders in the
  // browser, behind <AuthGuard>, so reading the window size here is safe.)
  const [splitPanelOpen, setSplitPanelOpen] = useState(
    () => !window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches,
  );
  const [splitPanelPreferences, setSplitPanelPreferences] = useState<AppLayoutProps.SplitPanelPreferences>({
    position: "side",
  });
  // Sizes the user dragged each page's panel to; otherwise the page's default.
  const [splitPanelSizes, setSplitPanelSizes] = useState<Record<string, number>>({});
  const splitPanel = page.splitPanel;
  // Always a number: AppLayout ignores a size prop that starts undefined and later
  // gets a value (uncontrolled -> controlled), which happens before a page registers.
  const splitPanelSize = splitPanel
    ? (splitPanelSizes[splitPanel.id] ?? splitPanel.defaultSize)
    : DEFAULT_SPLIT_PANEL_SIZE;

  // Client-side navigation for internal links (no full page reload).
  const followInternal = (event: CustomEvent<{ href: string; external?: boolean }>) => {
    if (event.detail.external) return; // opened in a new tab by the component
    event.preventDefault();
    router.push(event.detail.href);
  };

  return (
    <>
      <div id={HEADER_ID} style={{ position: "sticky", top: 0, zIndex: 1002 }}>
        <ConsoleTopNav />
      </div>
      <AppLayoutToolbar
        ref={appLayoutRef}
        headerSelector={`#${HEADER_ID}`}
        footerSelector={`#${FOOTER_ID}`}
        ariaLabels={{
          navigation: "Side navigation",
          navigationToggle: "Open side navigation",
          navigationClose: "Close side navigation",
          notifications: "Notifications",
          tools: "Help panel",
          toolsToggle: "Open help panel",
          toolsClose: "Close help panel",
        }}
        contentType={page.contentType ?? "default"}
        maxContentWidth={page.maxContentWidth}
        navigation={
          <SideNavigation
            header={{ text: "Route 53", href: "/" }}
            activeHref={activeNavHref(pathname)}
            items={NAV_ITEMS}
            onFollow={followInternal}
          />
        }
        navigationOpen={isForm ? formNavigationOpen : navigationOpen}
        onNavigationChange={({ detail }) =>
          isForm ? setFormNavigationOpen(detail.open) : setNavigationOpen(detail.open)
        }
        breadcrumbs={
          <BreadcrumbGroup
            ariaLabel="Breadcrumbs"
            items={[{ text: "Route 53", href: "/" }, ...page.breadcrumbs]}
            onFollow={followInternal}
          />
        }
        notifications={
          <Flashbar
            items={notifications}
            stackItems
            i18nStrings={{
              ariaLabel: "Notifications",
              notificationBarText: "Notifications",
              notificationBarAriaLabel: "View all notifications",
              errorIconAriaLabel: "Error",
              warningIconAriaLabel: "Warning",
              successIconAriaLabel: "Success",
              infoIconAriaLabel: "Info",
              inProgressIconAriaLabel: "In progress",
            }}
          />
        }
        stickyNotifications
        splitPanel={splitPanel?.content}
        splitPanelOpen={splitPanel ? splitPanelOpen : false}
        onSplitPanelToggle={({ detail }) => setSplitPanelOpen(detail.open)}
        splitPanelSize={splitPanelSize}
        onSplitPanelResize={({ detail }) => {
          if (splitPanel) setSplitPanelSizes((sizes) => ({ ...sizes, [splitPanel.id]: detail.size }));
        }}
        splitPanelPreferences={splitPanelPreferences}
        onSplitPanelPreferencesChange={({ detail }) => setSplitPanelPreferences(detail)}
        tools={helpTopic && <HelpTopicPanel topic={helpTopic} />}
        toolsHide={!helpTopic}
        toolsOpen={help.open && !!helpTopic}
        onToolsChange={({ detail }) => help.setOpen(detail.open)}
        content={children}
      />
      <ConsoleFooter id={FOOTER_ID} />
    </>
  );
}

/** The nav link to highlight: the section a page belongs to (zone details -> Hosted zones). */
function activeNavHref(pathname: string): string {
  if (pathname.startsWith("/hosted-zones")) return "/hosted-zones";
  return pathname;
}
