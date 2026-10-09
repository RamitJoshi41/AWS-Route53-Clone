"use client";

// Hosted zone tabs for features the clone shows but doesn't implement. Each one
// renders the console's "not enabled / empty" state; their buttons open the
// "not available" popover.

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Pagination from "@cloudscape-design/components/pagination";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Table from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";
import { useState } from "react";

import ComingSoonPopover from "@/components/ComingSoonPopover";
import InfoLink from "@/components/InfoLink";

function EmptyTableText({ children }: { children: string }) {
  return (
    <Box textAlign="center" color="inherit">
      {children}
    </Box>
  );
}

export function AcceleratedRecoveryTab() {
  return (
    <Container
      header={
        <Header
          variant="h2"
          info={<InfoLink topic="acceleratedRecovery" />}
          description="Enable the accelerated recovery option to ensure that you can continue to make changes to your public DNS records after an impairment to US East (N. Virginia)."
          actions={
            <ComingSoonPopover feature="Accelerated recovery">
              <Button>Enable</Button>
            </ComingSoonPopover>
          }
        >
          Accelerated recovery
        </Header>
      }
    >
      <Box variant="awsui-key-label">Status</Box>
      <StatusIndicator type="stopped">Disabled</StatusIndicator>
    </Container>
  );
}

export function DnssecSigningTab() {
  const [alertVisible, setAlertVisible] = useState(true);
  return (
    <SpaceBetween size="l">
      <Container
        header={
          <Header
            variant="h2"
            info={<InfoLink topic="dnssecSigning" />}
            actions={
              <ComingSoonPopover feature="DNSSEC signing">
                <Button>Enable DNSSEC signing</Button>
              </ComingSoonPopover>
            }
          >
            DNSSEC signing
          </Header>
        }
      >
        <SpaceBetween size="s">
          <div>
            <Box variant="awsui-key-label">DNSSEC signing status</Box>
            <StatusIndicator type="stopped">Not signing</StatusIndicator>
          </div>
          {alertVisible && (
            <Alert
              type="info"
              dismissible
              onDismiss={() => setAlertVisible(false)}
              header="You have not enabled DNSSEC signing for this hosted zone"
            >
              To enable DNSSEC signing and have Route 53 create a key-signing key (KSK) for you, choose Enable DNSSEC
              signing. Next, you must establish a DNSSEC chain of trust for your hosted zone. You&apos;ll complete this
              step after you enable DNSSEC signing.
            </Alert>
          )}
        </SpaceBetween>
      </Container>
      <Table
        items={[]}
        columnDefinitions={[
          { id: "name", header: "Name", cell: () => null, sortingField: "name" },
          { id: "status", header: "Status", cell: () => null, sortingField: "status" },
          { id: "created", header: "Creation date", cell: () => null, sortingField: "created" },
        ]}
        sortingColumn={{ sortingField: "name" }}
        header={
          <Header
            info={<InfoLink topic="dnssecSigning" />}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button disabled>View details</Button>
                <ComingSoonPopover feature="DNSSEC signing">
                  <Button>Switch to advanced view</Button>
                </ComingSoonPopover>
              </SpaceBetween>
            }
          >
            Key-signing keys (KSKs)
          </Header>
        }
        pagination={<Pagination currentPageIndex={1} pagesCount={1} />}
        empty={<EmptyTableText>No key-signing keys created.</EmptyTableText>}
      />
    </SpaceBetween>
  );
}

export function ZoneTagsTab() {
  const [filter, setFilter] = useState("");
  return (
    <Table
      items={[]}
      columnDefinitions={[
        { id: "key", header: "Key", cell: () => null, sortingField: "key" },
        { id: "value", header: "Value", cell: () => null, sortingField: "value" },
      ]}
      sortingColumn={{ sortingField: "key" }}
      header={
        <Header
          variant="h2"
          actions={
            <ComingSoonPopover feature="Tags">
              <Button>Manage tags</Button>
            </ComingSoonPopover>
          }
        >
          Tags
        </Header>
      }
      filter={
        <TextFilter
          filteringText={filter}
          onChange={({ detail }) => setFilter(detail.filteringText)}
          filteringPlaceholder="Search"
          filteringAriaLabel="Search tags"
        />
      }
      pagination={<Pagination currentPageIndex={1} pagesCount={1} />}
      empty={<EmptyTableText>No tags associated with the resource.</EmptyTableText>}
    />
  );
}
