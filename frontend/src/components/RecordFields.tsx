"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import Toggle from "@cloudscape-design/components/toggle";

import InfoLink from "@/components/InfoLink";
import type { CreateRecordInput, DnsRecord, RecordType } from "@/lib/api";
import {
  ROUTING_POLICY_OPTIONS,
  TTL_PRESETS,
  nameSpacesWarning,
  valuesFromText,
  recordTypeLabel,
  recordTypeOptions,
  typeInfo,
} from "@/lib/recordTypes";
import { displayName } from "@/lib/zones";

import styles from "./RecordFields.module.css";

/** One record as typed into the form; converted to the API's shape on submit. */
export type RecordDraft = {
  /** The part before the zone name; blank for the zone apex. */
  subdomain: string;
  /** SOA only when editing the zone's own SOA record, whose type is read-only. */
  type: RecordType | "SOA";
  /** The Value box: one value per line. */
  value: string;
  /** As typed, so the box can be empty or hold a half-typed number. */
  ttl: string;
};

/** An existing record as a draft, for the edit panel. */
export function draftFromRecord(record: DnsRecord, zoneName: string): RecordDraft {
  return {
    // "www.example.com." in zone "example.com." -> "www"; the apex -> "".
    subdomain: record.name === zoneName ? "" : record.name.slice(0, -(zoneName.length + 1)),
    type: record.type as RecordDraft["type"],
    value: record.values.join("\n"),
    ttl: String(record.ttl),
  };
}

/** The console's one check before calling the API; every other rule is the backend's (error banner). */
export function draftNameError(draft: RecordDraft): string | undefined {
  return draft.type === "NS" && draft.subdomain.trim() === "" ? "Record name is required for NS records." : undefined;
}

/** A draft as the API takes it: the full name, and the values one per non-blank line. */
export function draftToInput(draft: RecordDraft, zoneName: string): CreateRecordInput {
  const subdomain = draft.subdomain.trim();
  const ttl = draft.ttl.trim();
  return {
    name: subdomain ? `${subdomain}.${zoneName}` : zoneName,
    // Creatable types only: SOA's type is never sent (it can't change).
    type: draft.type as RecordType,
    // Not a whole number: NaN is sent as null, and the API reports the TTL as invalid.
    ttl: /^\d+$/.test(ttl) ? Number(ttl) : NaN,
    values: valuesFromText(draft.value),
  };
}

type Props = {
  draft: RecordDraft;
  onChange: (draft: RecordDraft) => void;
  zoneName: string;
  privateZone: boolean;
  /** Shown under Record name, e.g. "Record name is required for NS records." */
  nameError?: string;
  /**
   * The zone's SOA and apex NS records keep their name and type: the edit panel
   * shows both as plain text (screenshot 07).
   */
  fixedNameAndType?: boolean;
};

// The Value box grows with its lines, up to this many.
const MAX_VALUE_ROWS = 10;

/** A read-only field, as the edit panel shows the SOA/apex NS record's name and type. */
function FixedField({ label, children }: { label: string; children: string }) {
  return (
    <div>
      <Box color="text-body-secondary">{label}</Box>
      <Box padding={{ top: "xxs" }}>{children}</Box>
    </div>
  );
}

/**
 * The fields of one record, on the Create record page and in the edit panel, in the
 * console's layout (two columns where there's room, one in the narrow panel):
 *   Record name [subdomain].zone      | Record type
 *   Alias (toggle)
 *   Value (one per line)
 *   TTL [300] 1m 1h 1d                 | Routing policy
 */
export default function RecordFields({
  draft,
  onChange,
  zoneName,
  privateZone,
  nameError,
  fixedNameAndType = false,
}: Props) {
  const set = (changes: Partial<RecordDraft>) => onChange({ ...draft, ...changes });
  const info = typeInfo(draft.type);
  const lines = draft.value.split("\n").length;

  // ColumnLayout (not Grid): it switches to one column by its own width, so the
  // same fields fit the create page and the narrow split panel.
  return (
    <SpaceBetween size="l">
      <ColumnLayout columns={2}>
        {fixedNameAndType ? (
          <FixedField label="Record name">
            {displayName(draft.subdomain ? `${draft.subdomain}.${zoneName}` : zoneName)}
          </FixedField>
        ) : (
          <FormField
            label="Record name"
            info={<InfoLink topic="recordName" />}
            constraintText="Keep blank to create a record for the root domain."
            errorText={nameError}
            warningText={nameError ? undefined : nameSpacesWarning(draft.subdomain)}
            stretch
          >
            <div className={styles.nameRow}>
              <div className={styles.nameInput}>
                <Input
                  value={draft.subdomain}
                  onChange={({ detail }) => set({ subdomain: detail.value })}
                  placeholder="subdomain"
                  ariaLabel="Record name"
                />
              </div>
              <span className={styles.zoneSuffix}>.{displayName(zoneName)}</span>
            </div>
          </FormField>
        )}

        {fixedNameAndType ? (
          <FixedField label="Record type">{recordTypeLabel(draft.type, privateZone)}</FixedField>
        ) : (
          <FormField label="Record type" info={<InfoLink topic="recordType" />} stretch>
            <Select
              selectedOption={{ value: draft.type, label: recordTypeLabel(draft.type, privateZone) }}
              onChange={({ detail }) => set({ type: detail.selectedOption.value as RecordType })}
              options={recordTypeOptions(privateZone)}
              ariaLabel="Record type"
            />
          </FormField>
        )}
      </ColumnLayout>

      {/* Alias records route to AWS resources, which the clone doesn't have. */}
      <Toggle checked={false} disabled>
        Alias
      </Toggle>

      <FormField
        label="Value"
        info={<InfoLink topic="value" />}
        constraintText={["Enter multiple values on separate lines.", info.format].filter(Boolean).join(" ")}
        stretch
      >
        <Textarea
          value={draft.value}
          onChange={({ detail }) => set({ value: detail.value })}
          placeholder={info.placeholder}
          rows={Math.min(Math.max(lines, 3), MAX_VALUE_ROWS)}
          ariaLabel="Value"
        />
      </FormField>

      <ColumnLayout columns={2}>
        <FormField
          label="TTL (seconds)"
          info={<InfoLink topic="ttl" />}
          constraintText="Recommended values: 60 to 172800 (two days)"
          stretch
        >
          <div className={styles.ttlRow}>
            <div className={styles.ttlInput}>
              <Input
                type="number"
                inputMode="numeric"
                value={draft.ttl}
                onChange={({ detail }) => set({ ttl: detail.value })}
                ariaLabel="TTL (seconds)"
              />
            </div>
            <SpaceBetween direction="horizontal" size="xs">
              {TTL_PRESETS.map(({ label, seconds }) => (
                <Button key={label} formAction="none" onClick={() => set({ ttl: String(seconds) })}>
                  {label}
                </Button>
              ))}
            </SpaceBetween>
          </div>
        </FormField>

        <FormField label="Routing policy" info={<InfoLink topic="routingPolicy" />} stretch>
          <Select
            selectedOption={ROUTING_POLICY_OPTIONS[0]}
            options={ROUTING_POLICY_OPTIONS}
            ariaLabel="Routing policy"
          />
        </FormField>
      </ColumnLayout>
    </SpaceBetween>
  );
}
