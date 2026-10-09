"use client";

import Alert from "@cloudscape-design/components/alert";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import { use } from "react";

import { Field } from "@/components/ZoneDetailsFields";
import { InfoLink } from "@/components/ZoneFormParts";
import { useChange } from "@/lib/changes";
import { useConsolePage } from "@/lib/console-page";
import { formatConsoleDateTime, parseApiDate } from "@/lib/datetime";
import { displayName, useZone } from "@/lib/zones";

/** The console's "Change Info" page, opened by "View status" (screenshots View_Status, Success_STatus). */
export default function ChangeInfoPage({ params }: PageProps<"/hosted-zones/[zoneId]/changes/[changeId]">) {
  const { zoneId, changeId } = use(params);
  const changeQuery = useChange(changeId);
  const zone = useZone(zoneId).data; // only for the breadcrumb's zone name

  useConsolePage({
    breadcrumbs: [
      { text: "Hosted zones", href: "/hosted-zones" },
      { text: zone ? displayName(zone.name) : zoneId, href: `/hosted-zones/${zoneId}` },
      { text: "Change Info", href: `/hosted-zones/${zoneId}/changes/${changeId}` },
    ],
    // Measured from the console: a centred column, unlike the full-width zone pages.
    maxContentWidth: 1296,
  });

  const change = changeQuery.data;
  return (
    <SpaceBetween size="l">
      <Header variant="h1" info={<InfoLink />}>
        {changeId}
      </Header>

      {changeQuery.isError ? (
        <Alert
          type="error"
          header="Unable to retrieve the change"
          action={<Button onClick={() => changeQuery.refetch()}>Retry</Button>}
        >
          {changeQuery.error.message}
        </Alert>
      ) : (
        <Container
          header={
            <Header
              actions={
                <Button
                  iconName="refresh"
                  ariaLabel="Refresh change info"
                  loading={changeQuery.isFetching}
                  onClick={() => changeQuery.refetch()}
                />
              }
            >
              Change info details
            </Header>
          }
        >
          {change ? (
            <ColumnLayout columns={2}>
              <SpaceBetween size="m">
                <Field label="ID">/change/{change.id}</Field>
                <Field label="Status">
                  {/* The console's icons: a dotted circle while pending, a green check once in sync. */}
                  {change.status === "INSYNC" ? (
                    <StatusIndicator type="success">INSYNC</StatusIndicator>
                  ) : (
                    <StatusIndicator type="in-progress" colorOverride="grey">
                      PENDING
                    </StatusIndicator>
                  )}
                </Field>
              </SpaceBetween>
              <SpaceBetween size="m">
                <Field label="Submitted at">{formatConsoleDateTime(parseApiDate(change.submitted_at))}</Field>
                <Field label="Comment">{change.comment ?? "-"}</Field>
              </SpaceBetween>
            </ColumnLayout>
          ) : (
            <StatusIndicator type="loading">Loading change</StatusIndicator>
          )}
        </Container>
      )}
    </SpaceBetween>
  );
}
