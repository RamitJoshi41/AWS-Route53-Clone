"use client";

import Badge from "@cloudscape-design/components/badge";
import Button from "@cloudscape-design/components/button";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Tabs, { type TabsProps } from "@cloudscape-design/components/tabs";
import { useRouter } from "next/navigation";
import { use, useState } from "react";

import DeleteZoneModal from "@/components/DeleteZoneModal";
import RecordDetailsPanel from "@/components/RecordDetailsPanel";
import RecordsTable from "@/components/RecordsTable";
import { AcceleratedRecoveryTab, DnssecSigningTab, ZoneTagsTab } from "@/components/ZoneFeatureTabs";
import ZoneDetailsFields from "@/components/ZoneDetailsFields";
import { InfoLink } from "@/components/ZoneFormParts";
import ZoneLoadError from "@/components/ZoneLoadError";
import { useConsolePage } from "@/lib/console-page";
import { displayName, useZone } from "@/lib/zones";

const LIST_HREF = "/hosted-zones";

export default function HostedZoneDetailsPage({ params }: PageProps<"/hosted-zones/[zoneId]">) {
  const { zoneId } = use(params);
  const router = useRouter();
  const zoneQuery = useZone(zoneId);
  const loadedZone = zoneQuery.data;
  const [selectedRecordIds, setSelectedRecordIds] = useState<number[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Only records still in the zone count: a refresh may have dropped a deleted one.
  const selectedRecords = loadedZone?.records.filter((record) => selectedRecordIds.includes(record.id)) ?? [];
  useConsolePage({
    breadcrumbs: [
      { text: "Hosted zones", href: LIST_HREF },
      { text: loadedZone ? displayName(loadedZone.name) : zoneId, href: `${LIST_HREF}/${zoneId}` },
    ],
    splitPanel: loadedZone
      ? {
          id: "hosted-zone-details",
          defaultSize: 643,
          content: <RecordDetailsPanel selected={selectedRecords} />,
        }
      : undefined,
  });

  if (zoneQuery.isPending) {
    return <StatusIndicator type="loading">Loading hosted zone</StatusIndicator>;
  }

  if (zoneQuery.isError) {
    return <ZoneLoadError error={zoneQuery.error} onRetry={() => zoneQuery.refetch()} />;
  }

  // Past the loading and error states, so the zone is here (TypeScript narrows the query).
  const zone = zoneQuery.data;
  const isPublic = zone.type === "public";
  const editHref = `${LIST_HREF}/${zone.id}/edit?from=details`;

  // Private zones have only the Records and tags tabs (screenshot 21).
  const tabs: TabsProps.Tab[] = [
    {
      id: "records",
      label: `Records (${zone.records.length})`,
      content: (
        <RecordsTable
          zoneName={zone.name}
          createHref={`${LIST_HREF}/${zone.id}/create-record`}
          records={zone.records}
          loading={zoneQuery.isFetching}
          onRefresh={() => zoneQuery.refetch()}
          selectedIds={selectedRecordIds}
          onSelectionChange={setSelectedRecordIds}
        />
      ),
    },
    ...(isPublic
      ? [
          { id: "accelerated-recovery", label: "Accelerated recovery", content: <AcceleratedRecoveryTab /> },
          { id: "dnssec", label: "DNSSEC signing", content: <DnssecSigningTab /> },
        ]
      : []),
    { id: "tags", label: "Hosted zone tags (0)", content: <ZoneTagsTab /> },
  ];

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        info={<InfoLink />}
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={() => setDeleteOpen(true)}>Delete zone</Button>
            {/* Not implemented in the clone; private zones have them disabled in the console. */}
            <Button disabled={!isPublic}>Test record</Button>
            <Button disabled={!isPublic}>Configure query logging</Button>
          </SpaceBetween>
        }
      >
        {/* Inline (not a layout box), so the "Info" link stays on the same line as the name. */}
        <Badge color={isPublic ? "blue" : "grey"}>{isPublic ? "Public" : "Private"}</Badge> {displayName(zone.name)}
      </Header>

      <ExpandableSection
        variant="container"
        headerText="Hosted zone details"
        headerActions={
          <Button
            href={editHref}
            onFollow={(event) => {
              event.preventDefault();
              router.push(editHref);
            }}
          >
            Edit hosted zone
          </Button>
        }
      >
        <ZoneDetailsFields zone={zone} nameServers={zone.name_servers} />
      </ExpandableSection>

      <Tabs tabs={tabs} ariaLabel="Hosted zone sections" />

      {deleteOpen && (
        <DeleteZoneModal zone={zone} onClose={() => setDeleteOpen(false)} onDeleted={() => router.push(LIST_HREF)} />
      )}
    </SpaceBetween>
  );
}
