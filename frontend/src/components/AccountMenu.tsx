"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import CopyToClipboard from "@cloudscape-design/components/copy-to-clipboard";
import Icon from "@cloudscape-design/components/icon";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useEffect, useId, useRef, useState } from "react";

import ComingSoonPopover from "@/components/ComingSoonPopover";
import { formatAccountId, mockAccountId } from "@/lib/account";
import type { User } from "@/lib/api";
import { useLogout } from "@/lib/auth";

import styles from "./AccountMenu.module.css";

// The console's account links; they belong to AWS accounts, which this clone mocks.
const ACCOUNT_LINKS = [
  "Account",
  "Organization",
  "Service Quotas",
  "Billing and Cost Management",
  "Security credentials",
  "Console Mobile App",
  "Agent Toolkit for AWS",
];

/**
 * The account menu at the right of the top bar (screenshot AccountDropdown): the
 * account tab hanging from the strip opens a dark panel attached under the bar,
 * with the account ID and name, the account links and Sign out. It renders inside
 * the top bar, so Cloudscape's dark top-navigation context styles its content.
 */
export default function AccountMenu({ user }: { user: User }) {
  const logoutMutation = useLogout();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Set by any mousedown inside the menu, including its "not available" popovers,
  // which render in a portal but still bubble through the menu in React's tree.
  const clickedInside = useRef(false);
  const accountId = mockAccountId(user.id);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = () => {
      // React's handlers ran first, so the flag already says where the click was.
      if (!clickedInside.current) setOpen(false);
      clickedInside.current = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.root} onMouseDown={() => (clickedInside.current = true)}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={`Account ${user.username}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.tab}>
          {user.username}
          <span className={styles.optional}> ({accountId})</span>
          <Icon name={open ? "caret-up-filled" : "caret-down-filled"} size="small" />
        </span>
        <span className={styles.user}>{user.username}</span>
      </button>

      {open && (
        <div id={panelId} className={styles.panel} role="dialog" aria-label="Account">
          <KeyValuePairs
            columns={1}
            items={[
              {
                label: "Account ID",
                value: (
                  <CopyToClipboard
                    variant="inline"
                    textToCopy={accountId}
                    textToDisplay={formatAccountId(accountId)}
                    copyButtonAriaLabel="Copy Account Id"
                    copySuccessText="Account ID copied"
                    copyErrorText="Account ID failed to copy"
                  />
                ),
              },
              {
                label: "Account name",
                value: (
                  <CopyToClipboard
                    variant="inline"
                    textToCopy={user.username}
                    copyButtonAriaLabel="Copy account name"
                    copySuccessText="Account name copied"
                    copyErrorText="Account name failed to copy"
                  />
                ),
              },
              {
                label: "Account color",
                value: (
                  <span className={styles.color}>
                    <span className={styles.dot} aria-hidden="true" />
                    Unset
                  </span>
                ),
              },
            ]}
          />

          <hr className={styles.divider} />
          <ul className={styles.links}>
            {ACCOUNT_LINKS.map((text) => (
              <li key={text}>
                <ComingSoonPopover feature={text} position="left">
                  <button type="button" className={styles.link}>
                    {text}
                  </button>
                </ComingSoonPopover>
              </li>
            ))}
          </ul>
          <hr className={styles.divider} />

          <SpaceBetween size="s">
            <Box float="right">
              <ComingSoonPopover feature="Multi-session support" position="left">
                <Button>Turn on multi-session support</Button>
              </ComingSoonPopover>
            </Box>
            <Box float="right">
              <Button
                variant="primary"
                loading={logoutMutation.isPending}
                // useLogout navigates to a plain /login itself once the backend confirms.
                onClick={() => logoutMutation.mutate()}
              >
                Sign out
              </Button>
            </Box>
          </SpaceBetween>
          {logoutMutation.isError && (
            <Box color="text-status-error" padding={{ top: "s" }}>
              Sign out failed: {logoutMutation.error.message}. You are still signed in.
            </Box>
          )}
        </div>
      )}
    </div>
  );
}
