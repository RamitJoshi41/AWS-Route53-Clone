"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useState } from "react";

import RecordFields, { draftFromRecord, draftNameError, draftToInput } from "@/components/RecordFields";
import type { DnsRecord, HostedZone } from "@/lib/api";
import { useNotifyChangeSubmitted } from "@/lib/changes";
import { apiErrorNotification, useNotifications } from "@/lib/notifications";
import { isProtectedRecord, useUpdateRecord } from "@/lib/records";
import { displayName } from "@/lib/zones";

/** The console's warning above the apex NS record's form (screenshot 07), with its own texts and link. */
function DefaultNsRecordWarning() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <Alert type="warning" dismissible dismissAriaLabel="Dismiss warning" onDismiss={() => setVisible(false)}>
      <p>
        When you create a hosted zone, Amazon Route 53 allocates a <i>delegation set</i> (a set of four name
        servers) to serve your hosted zone. Route 53 then creates a name server (NS) record inside the zone, with the
        same name as your hosted zone, that lists the four allocated name servers.
      </p>
      <p>
        If you change this NS record, it doesn&apos;t change the name servers that Route 53 allocated. There are use
        cases when you might change the NS record, such as configuring branded name servers. However, be aware that
        making incorrect changes to the NS record can cause your domain to become unavailable on the internet.{" "}
        <Link
          external
          href="https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/white-label-name-servers.html"
          fontSize="inherit"
        >
          Learn more
        </Link>
      </p>
    </Alert>
  );
}

type Props = {
  zone: HostedZone;
  record: DnsRecord;
  onCancel: () => void;
  /** After a successful save; the zone page clears the selection, as the console does. */
  onSaved: () => void;
};

/**
 * "Edit record" in the split panel (screenshots 07, Edit_Record_ErrorLocation). Saving
 * shows the blue "<name> was successfully updated." banner with "View status"; an
 * error shows the red banner at the top of the page and keeps the form as typed.
 */
export default function EditRecordForm({ zone, record, onCancel, onSaved }: Props) {
  const [draft, setDraft] = useState(() => draftFromRecord(record, zone.name));
  const [submitted, setSubmitted] = useState(false);
  const [errorNotificationId, setErrorNotificationId] = useState<string | null>(null);
  const updateRecord = useUpdateRecord(zone.id);
  const notifyChangeSubmitted = useNotifyChangeSubmitted();
  const { notify, dismiss } = useNotifications();

  // The SOA and apex NS records keep their name and type (read-only in the form).
  const fixedNameAndType = isProtectedRecord(record, zone.name);
  const nameError = fixedNameAndType ? undefined : draftNameError(draft);

  const save = () => {
    setSubmitted(true);
    if (nameError || updateRecord.isPending) return;
    if (errorNotificationId) {
      dismiss(errorNotificationId);
      setErrorNotificationId(null);
    }
    const { name, type, ttl, values } = draftToInput(draft, zone.name);
    updateRecord.mutate(
      // Every field of the form, as the console saves it; name and type only where they can change.
      { id: record.id, ...(fixedNameAndType ? {} : { name, type }), ttl, values },
      {
        onSuccess: ({ record: saved, change_info }) => {
          notifyChangeSubmitted(`${displayName(saved.name)} was successfully updated.`, change_info);
          onSaved();
        },
        onError: (error) => setErrorNotificationId(notify(apiErrorNotification(error))),
      },
    );
  };

  return (
    // A real <form>, so pressing Enter in a text field saves.
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <SpaceBetween size="l">
        {record.type === "NS" && record.name === zone.name && <DefaultNsRecordWarning />}
        <RecordFields
          draft={draft}
          onChange={setDraft}
          zoneName={zone.name}
          privateZone={zone.type === "private"}
          nameError={submitted ? nameError : undefined}
          fixedNameAndType={fixedNameAndType}
        />
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button formAction="none" variant="link" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="primary" loading={updateRecord.isPending}>
              Save
            </Button>
          </SpaceBetween>
        </Box>
      </SpaceBetween>
    </form>
  );
}
