"use client";

import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import CopyToClipboard from "@cloudscape-design/components/copy-to-clipboard";
import SplitPanel from "@cloudscape-design/components/split-panel";
import { useState } from "react";

import EditRecordForm from "@/components/EditRecordForm";
import { toRecordRow } from "@/components/RecordsTable";
import { Field } from "@/components/ZoneDetailsFields";
import type { DnsRecord, HostedZone } from "@/lib/api";

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
  zone: HostedZone;
  /** The selected records of the zone. */
  selected: DnsRecord[];
  /** After the edit form saved; the page clears the selection, as the console does. */
  onSaved: () => void;
};

/**
 * The split panel of a hosted zone's page (screenshot 06). One selected record shows
 * its details, and "Edit record" turns the panel into its edit form (screenshot 07);
 * none or several show "N records selected", as in the console.
 *
 * Give it a `key` that changes with the selection, so selecting another record leaves
 * the edit form.
 */
export default function RecordDetailsPanel({ zone, selected, onSaved }: Props) {
  const [editing, setEditing] = useState(false);

  if (selected.length !== 1) {
    return (
      <SplitPanel header={`${selected.length} records selected`}>
        {selected.length === 0 ? "Select a record to see its details" : null}
      </SplitPanel>
    );
  }

  const record = selected[0];
  if (editing) {
    return (
      <SplitPanel header="Edit record">
        <EditRecordForm zone={zone} record={record} onCancel={() => setEditing(false)} onSaved={onSaved} />
      </SplitPanel>
    );
  }

  const row = toRecordRow(record);
  // A two-column grid filled row by row, like the console: on the side it reads
  // [Edit | name] [type | value] [alias | TTL] [routing policy], and in a narrow
  // panel the same items stack in that order.
  return (
    <SplitPanel header="Record details">
      <ColumnLayout columns={2} variant="text-grid">
        <Button onClick={() => setEditing(true)}>Edit record</Button>
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
