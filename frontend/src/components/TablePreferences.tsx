"use client";

// The console's table Preferences dialog (gear icon), shared by the hosted zones and
// records tables (screenshots 25 and 28): page size, wrap lines, search mode and
// visible columns. Also the "… mode is the current search behavior" sentence above
// each table, whose link opens the same dialog.

import CollectionPreferences, {
  type CollectionPreferencesProps,
} from "@cloudscape-design/components/collection-preferences";
import FormField from "@cloudscape-design/components/form-field";
import Link from "@cloudscape-design/components/link";
import RadioGroup from "@cloudscape-design/components/radio-group";
import type { RefObject } from "react";

// The console's search modes. The clone filters in the browser, where every mode
// behaves the same, so the choice only changes the sentence above the table.
export type SearchMode = "automatic" | "full" | "fast";
const SEARCH_MODES: { value: SearchMode; label: string; description: string }[] = [
  {
    value: "automatic",
    label: "Automatic",
    description: "The service chooses a filter mode based on the total number of items.",
  },
  {
    value: "full",
    label: "Full",
    description: "All search filters are available, but search performance might be slower.",
  },
  {
    value: "fast",
    label: "Fast",
    description: "Some advanced searches may not be available, but search performance will be faster.",
  },
];

export type TablePreferencesValue = CollectionPreferencesProps.Preferences<SearchMode>;

const PAGE_SIZE_OPTIONS = [10, 30, 50, 100].map((value) => ({ value, label: `${value} items` }));

type Props = {
  preferences: TablePreferencesValue;
  /** Fills in anything the dialog doesn't return, so the result is always complete. */
  defaults: TablePreferencesValue;
  /** The "Select visible columns" toggles, all under the console's "Properties" heading. */
  columns: { id: string; label: string }[];
  onConfirm: (preferences: TablePreferencesValue) => void;
};

/** For a table's `preferences` slot. */
export default function TablePreferences({ preferences, defaults, columns, onConfirm }: Props) {
  return (
    <CollectionPreferences
      title="Preferences"
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      preferences={preferences}
      onConfirm={({ detail }) => onConfirm({ ...defaults, ...detail })}
      pageSizePreference={{ title: "Page size", options: PAGE_SIZE_OPTIONS }}
      wrapLinesPreference={{ label: "Wrap lines", description: "Check to see all the text and wrap the lines." }}
      visibleContentPreference={{
        title: "Select visible columns",
        options: [{ label: "Properties", options: columns }],
      }}
      customPreference={(mode: SearchMode, setMode) => (
        <FormField label="Search mode">
          <RadioGroup
            value={mode}
            onChange={({ detail }) => setMode(detail.value as SearchMode)}
            items={SEARCH_MODES}
          />
        </FormField>
      )}
    />
  );
}

/**
 * "Automatic mode is the current search behavior optimized for best filter results.
 * To change modes go to settings." The link opens the table's Preferences dialog.
 *
 * CollectionPreferences can't be opened from code, so the link clicks the dialog's
 * gear button, found inside the element `tableRef` points to.
 */
export function SearchModeDescription({
  mode,
  tableRef,
}: {
  mode: SearchMode | undefined;
  tableRef: RefObject<HTMLElement | null>;
}) {
  const label = SEARCH_MODES.find((m) => m.value === mode)?.label ?? "Automatic";
  const openPreferences = (event: CustomEvent) => {
    event.preventDefault();
    tableRef.current?.querySelector<HTMLButtonElement>('button[aria-label="Preferences"]')?.click();
  };
  return (
    <>
      {label === "Automatic"
        ? "Automatic mode is the current search behavior optimized for best filter results."
        : `${label} mode is the current search behavior.`}{" "}
      <Link href="#" variant="primary" fontSize="inherit" onFollow={openPreferences}>
        To change modes go to settings.
      </Link>
    </>
  );
}

