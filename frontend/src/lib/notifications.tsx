"use client";

// Console notifications (the flash messages above the page content). Held in the
// (console) layout, so a message survives navigation: e.g. "created" is pushed on
// the create page and shown on the zone's details page it navigates to.

import Box from "@cloudscape-design/components/box";
import type { FlashbarProps } from "@cloudscape-design/components/flashbar";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { ApiError } from "@/lib/api";

export type Notification = {
  type: "success" | "error" | "info";
  header?: ReactNode;
  content?: ReactNode;
  /** Shows a spinner instead of the icon: for "in progress" messages. */
  loading?: boolean;
};

type NotificationsApi = {
  /** Shows a message and returns its id (for replace/dismiss). */
  notify: (notification: Notification) => string;
  /** Swaps a message for another in place, e.g. "Creating…" -> "created". */
  replace: (id: string, notification: Notification) => void;
  dismiss: (id: string) => void;
};

const NotificationsApiContext = createContext<NotificationsApi | null>(null);
const NotificationsListContext = createContext<FlashbarProps.MessageDefinition[]>([]);

let nextId = 0;

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<(Notification & { id: string })[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback((notification: Notification) => {
    const id = `notification-${nextId++}`;
    // Newest first, as the console stacks them.
    setItems((current) => [{ ...notification, id }, ...current]);
    return id;
  }, []);

  const replace = useCallback((id: string, notification: Notification) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...notification, id } : item)));
  }, []);

  // Two contexts: pages use the API (stable, never changes), only the shell reads
  // the list. So adding a message re-renders the Flashbar, not every page.
  const api = useMemo(() => ({ notify, replace, dismiss }), [notify, replace, dismiss]);
  const messages = useMemo(
    () =>
      items.map(
        ({ id, ...item }): FlashbarProps.MessageDefinition => ({
          ...item,
          id,
          // In-progress messages can still be closed in the console (screenshot 20).
          dismissible: true,
          dismissLabel: "Dismiss message",
          onDismiss: () => dismiss(id),
        }),
      ),
    [items, dismiss],
  );

  return (
    <NotificationsApiContext.Provider value={api}>
      <NotificationsListContext.Provider value={messages}>{children}</NotificationsListContext.Provider>
    </NotificationsApiContext.Provider>
  );
}

export function useNotifications(): NotificationsApi {
  const api = useContext(NotificationsApiContext);
  if (!api) throw new Error("useNotifications must be used inside <NotificationsProvider>");
  return api;
}

/** The current messages, for the shell's Flashbar. */
export function useNotificationMessages(): FlashbarProps.MessageDefinition[] {
  return useContext(NotificationsListContext);
}

/**
 * The console's red error banner for a failed request:
 *   Error occurred
 *   Please try again later.
 *   (<the API's message>)
 */
export function apiErrorNotification(error: unknown): Notification {
  const message = error instanceof ApiError || error instanceof Error ? error.message : String(error);
  return {
    type: "error",
    header: "Error occurred",
    content: (
      <>
        Please try again later.
        <Box variant="code" display="block" color="inherit">
          ({message})
        </Box>
      </>
    ),
  };
}
