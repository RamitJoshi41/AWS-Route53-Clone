"use client";

import Popover, { type PopoverProps } from "@cloudscape-design/components/popover";
import type { ReactNode } from "react";

/**
 * Wraps a console control this clone doesn't implement (CloudShell, Notifications,
 * footer links, ...): clicking it opens a small popover saying so, the same message
 * as the "Coming soon" pages behind unbuilt side-navigation links.
 * The child should be a focusable control (a Cloudscape Button).
 */
export default function ComingSoonPopover({
  feature,
  position = "bottom",
  children,
}: {
  feature: string;
  position?: PopoverProps.Position;
  children: ReactNode;
}) {
  return (
    <Popover
      triggerType="custom"
      position={position}
      size="small"
      header={feature}
      content={`${feature} is not available in this Route 53 clone yet.`}
      dismissAriaLabel="Close"
      // In a portal, so the popover isn't clipped by (or styled like) the bar it sits in.
      renderWithPortal
    >
      {children}
    </Popover>
  );
}
