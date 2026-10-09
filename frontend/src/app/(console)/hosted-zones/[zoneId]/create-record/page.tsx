"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Form from "@cloudscape-design/components/form";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import { useRouter } from "next/navigation";
import { use, useState } from "react";

import RecordFields, { draftNameError, draftToInput, type RecordDraft } from "@/components/RecordFields";
import RecordsTable from "@/components/RecordsTable";
import InfoLink from "@/components/InfoLink";
import ZoneLoadError from "@/components/ZoneLoadError";
import { useNotifyChangeSubmitted } from "@/lib/changes";
import { useConsolePage } from "@/lib/console-page";
import { apiErrorNotification, useNotifications } from "@/lib/notifications";
import { DEFAULT_TTL } from "@/lib/recordTypes";
import { useCreateRecords } from "@/lib/records";
import { displayName, useZone } from "@/lib/zones";

import styles from "./page.module.css";

// Each record on the form keeps a stable key, so deleting "Record 1" doesn't make
// React reuse its inputs for the record that moves up.
type DraftRow = RecordDraft & { key: number };
let nextKey = 0;
const newDraft = (): DraftRow => ({ key: nextKey++, subdomain: "", type: "A", value: "", ttl: String(DEFAULT_TTL) });

/** The console's "Create record" page in Quick create mode (screenshots 04, 05, Creating_Multiple_REcords). */
export default function CreateRecordPage({ params }: PageProps<"/hosted-zones/[zoneId]/create-record">) {
  const { zoneId } = use(params);
  const zoneHref = `/hosted-zones/${zoneId}`;
  const router = useRouter();
  const zoneQuery = useZone(zoneId);
  const createRecords = useCreateRecords(zoneId);
  const { notify, replace, dismiss } = useNotifications();
  const notifyChangeSubmitted = useNotifyChangeSubmitted();

  const [drafts, setDrafts] = useState<DraftRow[]>(() => [newDraft()]);
  // As on the other forms, errors appear after the first submit, then update as you type.
  const [submitted, setSubmitted] = useState(false);
  const [errorNotificationId, setErrorNotificationId] = useState<string | null>(null);
  const [existingSelection, setExistingSelection] = useState<number[]>([]);

  useConsolePage({
    helpTopic: "configureRecords",
    breadcrumbs: [
      { text: "Hosted zones", href: "/hosted-zones" },
      { text: zoneQuery.data ? displayName(zoneQuery.data.name) : zoneId, href: zoneHref },
      { text: "Create record", href: `${zoneHref}/create-record` },
    ],
    contentType: "form",
  });

  if (zoneQuery.isPending) {
    return <StatusIndicator type="loading">Loading hosted zone</StatusIndicator>;
  }
  if (zoneQuery.isError) {
    return <ZoneLoadError error={zoneQuery.error} onRetry={() => zoneQuery.refetch()} />;
  }
  const zone = zoneQuery.data;
  const zoneName = displayName(zone.name);

  const updateDraft = (key: number, draft: RecordDraft) =>
    setDrafts((current) => current.map((row) => (row.key === key ? { ...draft, key } : row)));

  const submit = () => {
    setSubmitted(true);
    if (drafts.some(draftNameError) || createRecords.isPending) return;
    if (errorNotificationId) {
      dismiss(errorNotificationId);
      setErrorNotificationId(null);
    }

    const progressId = notify({ type: "info", loading: true, header: `Creating record(s) for ${zoneName}` });
    createRecords.mutate(
      drafts.map((draft) => draftToInput(draft, zone.name)),
      {
        onSuccess: ({ records, change_info }) => {
          dismiss(progressId);
          notifyChangeSubmitted(
            records.length === 1
              ? `${displayName(records[0].name)} was successfully created.`
              : `Records for ${zoneName} were successfully created.`,
            change_info,
          );
          router.push(zoneHref);
        },
        onError: (error) => {
          // The "Creating…" banner turns into the error banner; the form keeps what was typed.
          replace(progressId, apiErrorNotification(error));
          setErrorNotificationId(progressId);
        },
      },
    );
  };

  return (
    <SpaceBetween size="xl">
      {/* A real <form>, so pressing Enter in a text field submits it. */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Form
          header={
            <Header variant="h1" info={<InfoLink topic="configureRecords" />}>
              Create record
            </Header>
          }
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button formAction="none" variant="link" onClick={() => router.push(zoneHref)}>
                Cancel
              </Button>
              <Button variant="primary" loading={createRecords.isPending}>
                Create records
              </Button>
            </SpaceBetween>
          }
        >
          <Container
            header={
              <Header
                variant="h2"
                // The wizard (one step per setting) isn't part of the clone.
                actions={
                  <Button formAction="none" variant="inline-link" disabled>
                    Switch to wizard
                  </Button>
                }
              >
                Quick create record
              </Header>
            }
            footer={
              <Box float="right">
                <Button formAction="none" onClick={() => setDrafts((current) => [...current, newDraft()])}>
                  Add another record
                </Button>
              </Box>
            }
          >
            {drafts.map((draft, index) => (
              <div key={draft.key} className={`${styles.record} ${index > 0 ? styles.nextRecord : ""}`}>
                <ExpandableSection
                  variant="inline"
                  defaultExpanded
                  headerText={`Record ${index + 1}`}
                  headerActions={
                    <Button
                      formAction="none"
                      disabled={drafts.length === 1}
                      onClick={() => setDrafts((current) => current.filter((row) => row.key !== draft.key))}
                    >
                      Delete
                    </Button>
                  }
                >
                  <RecordFields
                    draft={draft}
                    onChange={(changed) => updateDraft(draft.key, changed)}
                    zoneName={zone.name}
                    privateZone={zone.type === "private"}
                    nameError={submitted ? draftNameError(draft) : undefined}
                  />
                </ExpandableSection>
              </div>
            ))}
          </Container>
        </Form>
      </form>

      <div className={styles.existing}>
        <ExpandableSection
          headerText={<span className={styles.existingHeader}>View existing records</span>}
          headerDescription={`The following table lists the existing records in ${zoneName}.`}
        >
          <RecordsTable
            readOnly
            zoneName={zone.name}
            records={zone.records}
            loading={zoneQuery.isFetching}
            onRefresh={() => zoneQuery.refetch()}
            selectedIds={existingSelection}
            onSelectionChange={setExistingSelection}
          />
        </ExpandableSection>
      </div>
    </SpaceBetween>
  );
}
