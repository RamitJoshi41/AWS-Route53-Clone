"use client";

// Changes: the "View status" side of record creates and edits. Each one returns a
// ChangeInfo; the success banner's "View status" button opens its Change Info page,
// which reads PENDING until Route 53 (here: the backend's mimicked delay) reports
// the change INSYNC.

import Button from "@cloudscape-design/components/button";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { getChange, type ChangeInfo } from "@/lib/api";
import { useNotifications } from "@/lib/notifications";

export const changeHref = (change: Pick<ChangeInfo, "id" | "zone_id">) =>
  `/hosted-zones/${change.zone_id}/changes/${change.id}`;

/** One change. Fetched fresh on every visit; the page's refresh button refetches it. */
export function useChange(id: string) {
  return useQuery({
    queryKey: ["changes", id],
    queryFn: ({ signal }) => getChange(id, signal),
    refetchOnWindowFocus: false,
  });
}

const PROPAGATION_TEXT =
  "Route 53 propagates your changes to all of the Route 53 authoritative DNS servers within 60 seconds. " +
  'Use "View status" button to check propagation status.';

/**
 * Returns a function showing the console's blue banner after a create or edit:
 *   <header>                                        [View status]
 *   Route 53 propagates your changes to all of … check propagation status.
 */
export function useNotifyChangeSubmitted() {
  const router = useRouter();
  const { notify } = useNotifications();
  return useCallback(
    (header: string, change: ChangeInfo) => {
      const href = changeHref(change);
      notify({
        type: "info",
        header,
        content: PROPAGATION_TEXT,
        action: (
          <Button
            href={href}
            onFollow={(event) => {
              event.preventDefault();
              router.push(href);
            }}
          >
            View status
          </Button>
        ),
      });
    },
    [notify, router],
  );
}
