"use client";

import Box from "@cloudscape-design/components/box";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import type { ReactNode } from "react";

import type { HostedZone } from "@/lib/api";
import { displayName, zoneTypeLong } from "@/lib/zones";

/** One read-only "label over value" field, as in the console's details sections. */
export function Field({
  label,
  children,
  plainLabel = false,
}: {
  label: string;
  children: ReactNode;
  /** Regular-weight label, as in the console's Record details panel (screenshot 06). */
  plainLabel?: boolean;
}) {
  return (
    <div style={{ wordBreak: "break-all" }}>
      {plainLabel ? <Box>{label}</Box> : <Box variant="awsui-key-label">{label}</Box>}
      <div>{children}</div>
    </div>
  );
}

type Props = {
  zone: HostedZone;
  /** From the zone's details; undefined while they load. Only shown for public zones. */
  nameServers?: string[];
  /** The split panel lists name servers as bullets; the details page as plain lines. */
  bulletedNameServers?: boolean;
};

/**
 * The "Hosted zone details" fields, in the console's three columns:
 *   name, ID, description | (query log), type, record count | name servers or VPCs
 * In a narrow container (the side split panel) the columns stack.
 */
export default function ZoneDetailsFields({ zone, nameServers, bulletedNameServers = false }: Props) {
  const isPublic = zone.type === "public";
  const servers = nameServers?.map(displayName);

  return (
    <ColumnLayout columns={3} variant="text-grid">
      <SpaceBetween size="s">
        <Field label="Hosted zone name">{displayName(zone.name)}</Field>
        <Field label="Hosted zone ID">{zone.id}</Field>
        <Field label="Description">{zone.description ?? "-"}</Field>
      </SpaceBetween>

      <SpaceBetween size="s">
        {/* Query logging isn't implemented; private zones have no such field. */}
        {isPublic && <Field label="Query log">-</Field>}
        <Field label="Type">{zoneTypeLong(zone.type)}</Field>
        <Field label="Record count">{zone.record_count}</Field>
      </SpaceBetween>

      {isPublic ? (
        <Field label="Name servers">
          {servers === undefined ? (
            <StatusIndicator type="loading">Loading</StatusIndicator>
          ) : bulletedNameServers ? (
            <ul style={{ margin: 0, paddingInlineStart: 16 }}>
              {servers.map((server) => (
                <li key={server}>{server}</li>
              ))}
            </ul>
          ) : (
            servers.map((server) => <div key={server}>{server}</div>)
          )}
        </Field>
      ) : (
        <Field label="Associated VPCs">
          {zone.vpcs.map((vpc) => (
            <div key={vpc.vpc_id}>
              {vpc.vpc_id} | {vpc.region}
            </div>
          ))}
        </Field>
      )}
    </ColumnLayout>
  );
}
