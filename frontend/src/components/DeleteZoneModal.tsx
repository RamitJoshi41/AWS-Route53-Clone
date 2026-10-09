"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { HostedZone } from "@/lib/api";
import { apiErrorNotification, useNotifications } from "@/lib/notifications";
import { displayName, hasNonDefaultRecords, useDeleteZone } from "@/lib/zones";

import styles from "./DeleteZoneModal.module.css";

const CONFIRMATION_WORD = "delete";

type Props = {
  zone: HostedZone;
  onClose: () => void;
  /** Called after a successful delete (the details page uses it to go back to the list). */
  onDeleted?: () => void;
};

/**
 * "Delete hosted zone <name>?" confirmation. Mount it to open it, unmount to close it,
 * so every opening starts with an empty confirmation field.
 *
 * The outcome is reported like the console does: a green "deleted" banner, or the red
 * "Error occurred" banner when Route 53 refuses (the zone still has records).
 */
export default function DeleteZoneModal({ zone, onClose, onDeleted }: Props) {
  const router = useRouter();
  const { notify } = useNotifications();
  const deleteZone = useDeleteZone();
  const [confirmation, setConfirmation] = useState("");

  const name = displayName(zone.name);
  const confirmed = confirmation === CONFIRMATION_WORD;

  const close = () => {
    // A delete in progress finishes first (the console keeps the dialog open meanwhile).
    if (!deleteZone.isPending) onClose();
  };

  const submit = () => {
    if (!confirmed || deleteZone.isPending) return;
    deleteZone.mutate(zone.id, {
      onSuccess: () => {
        notify({ type: "success", header: `Hosted zone ${name} was successfully deleted.` });
        onClose();
        onDeleted?.();
      },
      onError: (error) => {
        notify(apiErrorNotification(error));
        onClose();
      },
    });
  };

  const detailsHref = `/hosted-zones/${zone.id}`;

  return (
    <Modal
      visible
      onDismiss={close}
      header={`Delete hosted zone ${name}?`}
      closeAriaLabel="Close dialog"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!confirmed} loading={deleteZone.isPending} onClick={submit}>
              Delete
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <Box variant="p">
          Delete the hosted zone permanently? This action cannot be undone. Your domain might become unavailable on
          the internet.
        </Box>

        {/* Only when the delete would be refused: the zone has more than its NS and SOA records. */}
        {hasNonDefaultRecords(zone) && (
          <Alert type="warning" header={`Take these actions to delete hosted zone ${name}`}>
            {/* The console leaves a gap between the warning's title and its text. */}
            <Box padding={{ top: "s" }}>
              <SpaceBetween size="s">
                <span>
                  Complete the following steps to successfully delete this hosted zone. If you don&apos;t complete the
                  steps, the deletion might be blocked by Route 53 service validation.
                </span>
                <ul className={styles.steps}>
                  <li>Delete all records in this hosted zone, except the default NS and SOA records.</li>
                </ul>
                <Button
                  href={detailsHref}
                  onFollow={(event) => {
                    event.preventDefault();
                    onClose();
                    router.push(detailsHref);
                  }}
                >
                  Go to hosted zone details
                </Button>
              </SpaceBetween>
            </Box>
          </Alert>
        )}

        <div className={styles.divider} />

        {/* A form, so pressing Enter in the field confirms (once "delete" is typed). */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <FormField
            label={
              <>
                To confirm that you want to delete the hosted zone, enter <i>{CONFIRMATION_WORD}</i> in the field.
              </>
            }
          >
            <Input
              value={confirmation}
              onChange={({ detail }) => setConfirmation(detail.value)}
              placeholder={CONFIRMATION_WORD}
              ariaLabel={`Type ${CONFIRMATION_WORD} to confirm`}
            />
          </FormField>
        </form>
      </SpaceBetween>
    </Modal>
  );
}
