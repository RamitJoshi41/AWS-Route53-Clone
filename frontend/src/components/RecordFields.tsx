"use client";

import Button from "@cloudscape-design/components/button";
import FormField from "@cloudscape-design/components/form-field";
import Grid from "@cloudscape-design/components/grid";
import Input from "@cloudscape-design/components/input";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import Toggle from "@cloudscape-design/components/toggle";

import { InfoLink } from "@/components/ZoneFormParts";
import type { RecordType } from "@/lib/api";
import {
  RECORD_TYPES,
  ROUTING_POLICY_OPTIONS,
  TTL_PRESETS,
  nameSpacesWarning,
  recordTypeLabel,
  recordTypeOptions,
} from "@/lib/recordTypes";
import { displayName } from "@/lib/zones";

import styles from "./RecordFields.module.css";

/** One record as typed into the form; converted to the API's shape on submit. */
export type RecordDraft = {
  /** The part before the zone name; blank for the zone apex. */
  subdomain: string;
  type: RecordType;
  /** The Value box: one value per line. */
  value: string;
  /** As typed, so the box can be empty or hold a half-typed number. */
  ttl: string;
};

type Props = {
  draft: RecordDraft;
  onChange: (draft: RecordDraft) => void;
  zoneName: string;
  privateZone: boolean;
  /** Shown under Record name, e.g. "Record name is required for NS records." */
  nameError?: string;
};

// Two columns side by side on a wide screen, stacked on a narrow one.
const TWO_COLUMNS = [{ colspan: { default: 12, s: 6 } }, { colspan: { default: 12, s: 6 } }];

/**
 * The fields of one record in "Quick create record", in the console's layout:
 *   Record name [subdomain].zone      | Record type
 *   Alias (toggle)
 *   Value (one per line)
 *   TTL [300] 1m 1h 1d                 | Routing policy
 */
export default function RecordFields({ draft, onChange, zoneName, privateZone, nameError }: Props) {
  const set = (changes: Partial<RecordDraft>) => onChange({ ...draft, ...changes });
  const typeOptions = recordTypeOptions(privateZone);

  return (
    <SpaceBetween size="l">
      <Grid gridDefinition={TWO_COLUMNS}>
        <FormField
          label="Record name"
          info={<InfoLink />}
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

        <FormField label="Record type" info={<InfoLink />} stretch>
          <Select
            selectedOption={{ value: draft.type, label: recordTypeLabel(draft.type, privateZone) }}
            onChange={({ detail }) => set({ type: detail.selectedOption.value as RecordType })}
            options={typeOptions}
            ariaLabel="Record type"
          />
        </FormField>
      </Grid>

      {/* Alias records route to AWS resources, which the clone doesn't have. */}
      <Toggle checked={false} disabled>
        Alias
      </Toggle>

      <FormField
        label="Value"
        info={<InfoLink />}
        constraintText="Enter multiple values on separate lines."
        stretch
      >
        <Textarea
          value={draft.value}
          onChange={({ detail }) => set({ value: detail.value })}
          placeholder={RECORD_TYPES[draft.type].placeholder}
          rows={3}
          ariaLabel="Value"
        />
      </FormField>

      <Grid gridDefinition={TWO_COLUMNS}>
        <FormField
          label="TTL (seconds)"
          info={<InfoLink />}
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

        <FormField label="Routing policy" info={<InfoLink />} stretch>
          <Select
            selectedOption={ROUTING_POLICY_OPTIONS[0]}
            options={ROUTING_POLICY_OPTIONS}
            ariaLabel="Routing policy"
          />
        </FormField>
      </Grid>
    </SpaceBetween>
  );
}
