"use client";

import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import CopyToClipboard from "@cloudscape-design/components/copy-to-clipboard";
import SplitPanel from "@cloudscape-design/components/split-panel";

import { toRecordRow } from "@/components/RecordsTable";
import { Field } from "@/components/ZoneDetailsFields";
import type { DnsRecord } from "@/lib/api";

function Copyable({ text }: { text: string }) {
  return (
    <CopyToClipboard
      variant="inline"
      textToCopy={text}
      copyButtonAriaLabel={`Copy ${text}`}
      copySuccessText="Copied"
      copyErrorText="Failed to copy"
    />
  );
}

type Props = {
  /** The selected records of the zone. */
  selected: DnsRecord[];
  /** Opens the edit form for the record; arrives with editing (until then the button is disabled). */
  onEdit?: (record: DnsRecord) => void;
};

/**
 * The split panel of a hosted zone's page (screenshot 06). One selected record shows
 * its details; none or several show "N records selected", as in the console.
 */
export default function RecordDetailsPanel({ selected, onEdit }: Props) {
  if (selected.length !== 1) {
    return (
      <SplitPanel header={`${selected.length} records selected`}>
        {selected.length === 0 ? "Select a record to see its details" : null}
      </SplitPanel>
    );
  }

  const record = selected[0];
  const row = toRecordRow(record);
  // A two-column grid filled row by row, like the console: on the side it reads
  // [Edit | name] [type | value] [alias | TTL] [routing policy], and in a narrow
  // panel the same items stack in that order.
  return (
    <SplitPanel header="Record details">
      <ColumnLayout columns={2} variant="text-grid">
        <Button disabled={!onEdit} onClick={() => onEdit?.(record)}>
          Edit record
        </Button>
        <Field label="Record name">
          <Copyable text={row.name} />
        </Field>
        <Field label="Record type">{record.type}</Field>
        <Field label="Value">
          {record.values.map((value, i) => (
            <div key={i}>
              <Copyable text={value} />
            </div>
          ))}
        </Field>
        <Field label="Alias">{row.alias}</Field>
        <Field label="TTL (seconds)">{record.ttl.toLocaleString()}</Field>
        <Field label="Routing policy">{row.routingPolicy}</Field>
      </ColumnLayout>
    </SplitPanel>
  );
}
