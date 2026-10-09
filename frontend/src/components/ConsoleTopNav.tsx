"use client";

import Button from "@cloudscape-design/components/button";
import ButtonDropdown from "@cloudscape-design/components/button-dropdown";
import Icon from "@cloudscape-design/components/icon";
import Popover from "@cloudscape-design/components/popover";
import TopNavigation from "@cloudscape-design/components/top-navigation";
import Link from "next/link";

import AccountMenu from "@/components/AccountMenu";
import ComingSoonPopover from "@/components/ComingSoonPopover";
import ConsoleSearch from "@/components/ConsoleSearch";
import { useCurrentUser } from "@/lib/auth";

import styles from "./ConsoleTopNav.module.css";

// The console's "Services" button: a 3x3 grid of dots (Cloudscape has no such icon).
const SERVICES_ICON = (
  <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
    {[2, 8, 14].flatMap((y) =>
      [2, 8, 14].map((x) => <rect key={`${x}-${y}`} className="filled" x={x - 1.5} y={y - 1.5} width="3" height="3" />),
    )}
  </svg>
);

// The console's "Help & support" menu. Only public pages are linked; the console's
// Support Center and feedback form need a real AWS account.
const HELP_ITEMS = [
  {
    text: "Support",
    items: [
      { id: "support-center", text: "Support Center", disabled: true, disabledReason: "Needs a real AWS account." },
      { id: "repost", text: "re:Post", href: "https://repost.aws/tags?search=Route%2053", external: true },
      {
        id: "documentation",
        text: "Documentation",
        href: "https://docs.aws.amazon.com/route53/",
        external: true,
      },
      { id: "training", text: "Training", href: "https://aws.amazon.com/training/", external: true },
      {
        id: "getting-started",
        text: "Getting Started Resource Center",
        href: "https://aws.amazon.com/getting-started/",
        external: true,
      },
    ],
  },
  { id: "feedback", text: "Send feedback", disabled: true, disabledReason: "Not available in this Route 53 clone." },
];

/**
 * The console's dark top bar, laid out like the real one: identity, Services and
 * search on the left; CloudShell, Notifications, Help, Settings, the Region and the
 * account menu on the right. Built as TopNavigation custom content, so Cloudscape's
 * dark "top-navigation" context styles the buttons and the search box.
 */
export default function ConsoleTopNav() {
  const { data: user } = useCurrentUser();

  return (
    <TopNavigation visualContext="top-navigation">
      <div className={styles.bar}>
        <div className={styles.start}>
          <Link href="/" className={styles.identity}>
            Route 53 Clone
          </Link>
          <span className={styles.optional}>
            <ComingSoonPopover feature="Services">
              <Button variant="icon" iconSvg={SERVICES_ICON} ariaLabel="Services" />
            </ComingSoonPopover>
          </span>
          <div className={styles.search}>
            <ConsoleSearch />
          </div>
        </div>

        <div className={styles.end}>
          <span className={styles.optional}>
            <ComingSoonPopover feature="CloudShell">
              <Button variant="icon" iconName="command-prompt" ariaLabel="CloudShell" />
            </ComingSoonPopover>
          </span>
          <span className={styles.optional}>
            <ComingSoonPopover feature="Notifications">
              <Button variant="icon" iconName="notification" ariaLabel="Notifications" />
            </ComingSoonPopover>
          </span>
          <ButtonDropdown
            variant="icon"
            iconName="support"
            ariaLabel="Help & support"
            items={HELP_ITEMS}
            expandToViewport
          />
          {/* Task 5.4 turns this into the console's Settings menu (Visual mode). */}
          <ComingSoonPopover feature="Settings">
            <Button variant="icon" iconName="settings" ariaLabel="Settings" />
          </ComingSoonPopover>

          <span className={styles.optional}>
            <Popover
              triggerType="custom"
              position="bottom"
              size="small"
              header="Regions"
              content="Route 53 does not require region selection."
              dismissAriaLabel="Close"
              renderWithPortal
            >
              <button type="button" className={styles.region}>
                Global <Icon name="caret-down-filled" size="small" />
              </button>
            </Popover>
          </span>

          {user && <AccountMenu user={user} />}
        </div>
      </div>
    </TopNavigation>
  );
}
