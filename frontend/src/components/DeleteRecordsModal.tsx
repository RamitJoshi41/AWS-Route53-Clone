"use client";

import { useCollection } from "@cloudscape-design/collection-hooks";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Modal from "@cloudscape-design/components/modal";
import Pagination from "@cloudscape-design/components/pagination";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table, { type TableProps } from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";

import type { DnsRecord } from "@/lib/api";
import { apiErrorNotification, useNotifications } from "@/lib/notifications";
import { useDeleteRecords } from "@/lib/records";
import { displayName } from "@/lib/zones";

// The same divider as the zone dialog, so both dialogs look alike.
import styles from "./DeleteZoneModal.module.css";

type Row = { id: number; name: string; type: string; values: string[] };

const COLUMNS: TableProps.ColumnDefinition<Row>[] = [
  { id: "name", header: "Record name", cell: (row) => row.name, isRowHeader: true },
  { id: "type", header: "Type", cell: (row) => row.type },
  {
    id: "value",
    header: "Value/Route traffic to",
    cell: (row) => row.values.map((value, i) => <div key={i}>{value}</div>),
  },
];

type Props = {
  zoneId: string;
  /** The selected records; the page only opens the dialog when none of them is protected. */
  records: DnsRecord[];
  onClose: () => void;
  /** After the records were deleted; the page clears the selection. */
  onDeleted: () => void;
};

/**
 * "Delete N selected records?" (screenshots 10, Delete_REcord_1): the records listed in
 * a small searchable table, then one all-or-nothing delete. Mount it to open it.
 */
export default function DeleteRecordsModal({ zoneId, records, onClose, onDeleted }: Props) {
  const { notify } = useNotifications();
  const deleteRecords = useDeleteRecords(zoneId);
  const single = records.length === 1;

  const rows = records.map((r) => ({ id: r.id, name: displayName(r.name), type: r.type, values: r.values }));
  const { items, collectionProps, filterProps, paginationProps } = useCollection(rows, {
    filtering: {},
    pagination: { pageSize: 10 },
  });

  const close = () => {
    // A delete in progress finishes first (the console keeps the dialog open meanwhile).
    if (!deleteRecords.isPending) onClose();
  };

  const submit = () => {
    if (deleteRecords.isPending) return;
    deleteRecords.mutate(
      records.map((record) => record.id),
      {
        onSuccess: () => {
          // The console's wording, plural even for one record (screenshot Delete_Record_2).
          notify({ type: "success", header: "The records were successfully deleted." });
          onClose();
          onDeleted();
        },
        onError: (error) => {
          notify(apiErrorNotification(error));
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      visible
      onDismiss={close}
      header={single ? "Delete selected record?" : `Delete ${records.length} selected records?`}
      closeAriaLabel="Close dialog"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" loading={deleteRecords.isPending} onClick={submit}>
              Delete
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <Box variant="p">
          {single ? "Delete the record permanently?" : "Delete the records permanently?"} This action cannot be
          undone. Your domain might become unavailable on the internet.
        </Box>
        <div className={styles.divider} />
        <Table
          {...collectionProps}
          variant="container"
          items={items}
          columnDefinitions={COLUMNS}
          trackBy="id"
          ariaLabels={{ tableLabel: "Records to be deleted" }}
          filter={<TextFilter {...filterProps} filteringPlaceholder="Search" filteringAriaLabel="Search records" />}
          pagination={<Pagination {...paginationProps} />}
          empty={
            <Box textAlign="center" color="inherit">
              No matches
            </Box>
          }
        />
      </SpaceBetween>
    </Modal>
  );
}
