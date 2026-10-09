"use client";

import { useCollection } from "@cloudscape-design/collection-hooks";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import CollectionPreferences, {
  type CollectionPreferencesProps,
} from "@cloudscape-design/components/collection-preferences";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import Pagination from "@cloudscape-design/components/pagination";
import PropertyFilter, { type PropertyFilterProps } from "@cloudscape-design/components/property-filter";
import RadioGroup from "@cloudscape-design/components/radio-group";
import SpaceBetween from "@cloudscape-design/components/space-between";
import SplitPanel from "@cloudscape-design/components/split-panel";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Table, { type TableProps } from "@cloudscape-design/components/table";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type ReactNode } from "react";

import DeleteZoneModal from "@/components/DeleteZoneModal";
import ZoneDetailsFields from "@/components/ZoneDetailsFields";
import { useConsolePage } from "@/lib/console-page";
import { toZoneRow, useZone, useZones, type ZoneRow } from "@/lib/zones";

const CREATE_HREF = "/hosted-zones/create";
const zoneHref = (id: string) => `/hosted-zones/${id}`;

// The properties offered by the filter, as in the console: choosing one fills in
// "<Property> : " and suggests that column's values under a "values" heading. The
// token matches values that contain the typed text; there are no other operators.
const FILTERING_PROPERTIES: PropertyFilterProps.FilteringProperty[] = [
  ["name", "Hosted zone name"],
  ["type", "Type"],
  ["acceleratedRecovery", "Accelerated recovery"],
  ["createdBy", "Created by"],
  ["recordCount", "Record count"],
  ["description", "Description"],
  ["id", "Hosted zone ID"],
].map(([key, propertyLabel]) => ({
  key,
  propertyLabel,
  groupValuesLabel: "values",
  operators: [":"],
  defaultOperator: ":",
}));

// --- Preferences dialog, as in the console (25_Hosted_zones_preferences.png) ---

const PAGE_SIZE_OPTIONS = [10, 30, 50, 100].map((value) => ({ value, label: `${value} items` }));

// "Select visible columns": every column can be toggled; Accelerated recovery starts hidden.
const VISIBLE_COLUMN_OPTIONS: CollectionPreferencesProps.VisibleContentPreference = {
  title: "Select visible columns",
  options: [
    {
      label: "Properties",
      options: [
        { id: "name", label: "Hosted zone name" },
        { id: "type", label: "Type" },
        { id: "acceleratedRecovery", label: "Accelerated recovery" },
        { id: "createdBy", label: "Created by" },
        { id: "recordCount", label: "Record count" },
        { id: "description", label: "Description" },
        { id: "id", label: "Hosted zone ID" },
      ],
    },
  ],
};

// The console's search modes. The clone filters in the browser, where every mode
// behaves the same, so the choice only changes the sentence under the title.
type SearchMode = "automatic" | "full" | "fast";
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

const DEFAULT_PREFERENCES: CollectionPreferencesProps.Preferences<SearchMode> = {
  pageSize: 100,
  wrapLines: false,
  visibleContent: ["name", "type", "createdBy", "recordCount", "description", "id"],
  custom: "automatic",
};

function EmptyState({ title, subtitle, action }: { title: string; subtitle: string; action: ReactNode }) {
  return (
    <Box textAlign="center" color="inherit">
      <Box variant="strong" textAlign="center" color="inherit">
        {title}
      </Box>
      <Box variant="p" padding={{ bottom: "s" }} color="inherit">
        {subtitle}
      </Box>
      {action}
    </Box>
  );
}

export default function HostedZonesPage() {
  const router = useRouter();
  const zonesQuery = useZones();
  const rows = useMemo(() => (zonesQuery.data ?? []).map(toZoneRow), [zonesQuery.data]);
  // While (re)loading, the console replaces the rows with skeletons.
  const isLoading = zonesQuery.isFetching;

  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const searchMode = SEARCH_MODES.find((mode) => mode.value === preferences.custom) ?? SEARCH_MODES[0];

  const goTo = (href: string) => (event: CustomEvent) => {
    event.preventDefault();
    router.push(href);
  };

  const columnDefinitions: TableProps.ColumnDefinition<ZoneRow>[] = [
    {
      id: "name",
      header: "Hosted zone name",
      cell: (row) => (
        <Link href={zoneHref(row.id)} onFollow={goTo(zoneHref(row.id))}>
          {row.name}
        </Link>
      ),
      sortingField: "name",
      isRowHeader: true,
    },
    { id: "type", header: "Type", cell: (row) => row.type, sortingField: "type" },
    {
      id: "acceleratedRecovery",
      header: "Accelerated recovery",
      cell: (row) =>
        row.acceleratedRecovery === "Disabled" ? (
          <StatusIndicator type="stopped">Disabled</StatusIndicator>
        ) : (
          "-"
        ),
      sortingField: "acceleratedRecovery",
    },
    { id: "createdBy", header: "Created by", cell: (row) => row.createdBy, sortingField: "createdBy" },
    { id: "recordCount", header: "Record count", cell: (row) => row.recordCount, sortingField: "recordCount" },
    { id: "description", header: "Description", cell: (row) => row.description, sortingField: "description" },
    { id: "id", header: "Hosted zone ID", cell: (row) => row.id, sortingField: "id" },
  ];

  const { items, actions, filteredItemsCount, collectionProps, propertyFilterProps, paginationProps } =
    useCollection(rows, {
      propertyFiltering: { filteringProperties: FILTERING_PROPERTIES },
      sorting: {},
      pagination: { pageSize: preferences.pageSize },
      // Keep the selected zone selected across refreshes (rows are new objects each time).
      selection: { keepSelection: true, trackBy: "id" },
    });

  // Selection survives a refresh, but not the zone's deletion: only count it while it's listed.
  const selected = collectionProps.selectedItems?.find((row) => rows.some((r) => r.id === row.id));
  const selectedZone = rows.find((row) => row.id === selected?.id)?.zone;
  const selectedDetails = useZone(selectedZone?.type === "public" ? selectedZone.id : undefined);

  useConsolePage({
    breadcrumbs: [{ text: "Hosted zones", href: "/hosted-zones" }],
    contentType: "table",
    splitPanel: {
      id: "hosted-zones",
      defaultSize: 412,
      content: (
        <SplitPanel header={selectedZone ? "Hosted zone details" : "0 hosted zone selected"}>
          {selectedZone ? (
            <ZoneDetailsFields
              zone={selectedZone}
              nameServers={selectedDetails.data?.name_servers}
              bulletedNameServers
            />
          ) : (
            "Select a hosted zone to see its details"
          )}
        </SplitPanel>
      ),
    },
  });

  // "To change modes go to settings." opens the same Preferences dialog as the gear.
  // CollectionPreferences can't be opened from code, so the link clicks its button.
  const tableWrapper = useRef<HTMLDivElement>(null);
  const openPreferences = (event: CustomEvent) => {
    event.preventDefault();
    tableWrapper.current?.querySelector<HTMLButtonElement>('button[aria-label="Preferences"]')?.click();
  };

  const hasFilter = (propertyFilterProps.query.tokens?.length ?? 0) > 0;

  // What the table shows when it has no rows: the console's empty and no-match states.
  let emptyState: ReactNode;
  if (zonesQuery.isError) {
    emptyState = <LoadError onRetry={() => zonesQuery.refetch()} />;
  } else if (rows.length === 0) {
    emptyState = (
      <EmptyState
        title="No hosted zones"
        subtitle="There are no hosted zones created for this account."
        action={
          <Button variant="primary" href={CREATE_HREF} onFollow={goTo(CREATE_HREF)}>
            Create hosted zone
          </Button>
        }
      />
    );
  } else {
    emptyState = (
      <EmptyState
        title="No matches"
        subtitle="No results match your query."
        action={
          <Button onClick={() => actions.setPropertyFiltering({ tokens: [], operation: "and" })}>
            Clear filters
          </Button>
        }
      />
    );
  }

  return (
    <div ref={tableWrapper}>
      <Table
        {...collectionProps}
        variant="full-page"
        items={isLoading ? [] : items}
        columnDefinitions={columnDefinitions}
        trackBy="id"
        selectionType="single"
        loading={isLoading}
        loadingText="Loading hosted zones"
        skeleton={{ totalRows: 6 }}
        resizableColumns
        wrapLines={preferences.wrapLines}
        visibleColumns={preferences.visibleContent}
        ariaLabels={{
          selectionGroupLabel: "Hosted zone selection",
          itemSelectionLabel: (_, row) => row.name,
          allItemsSelectionLabel: () => "Select all",
        }}
        header={
          <Header
            variant="awsui-h1-sticky"
            counter={selected ? `(1/${rows.length})` : `(${rows.length})`}
            description={
              <>
                {searchMode.value === "automatic"
                  ? "Automatic mode is the current search behavior optimized for best filter results."
                  : `${searchMode.label} mode is the current search behavior.`}{" "}
                <Link href="#" variant="primary" fontSize="inherit" onFollow={openPreferences}>
                  To change modes go to settings.
                </Link>
              </>
            }
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  iconName="refresh"
                  ariaLabel="Refresh hosted zones"
                  loading={zonesQuery.isFetching}
                  onClick={() => zonesQuery.refetch()}
                />
                <Button
                  disabled={!selected}
                  href={selected && zoneHref(selected.id)}
                  onFollow={selected && goTo(zoneHref(selected.id))}
                >
                  View details
                </Button>
                <Button
                  disabled={!selected}
                  href={selected && `${zoneHref(selected.id)}/edit`}
                  onFollow={selected && goTo(`${zoneHref(selected.id)}/edit`)}
                >
                  Edit
                </Button>
                <Button disabled={!selected} onClick={() => setDeleteOpen(true)}>
                  Delete
                </Button>
                <Button variant="primary" href={CREATE_HREF} onFollow={goTo(CREATE_HREF)}>
                  Create hosted zone
                </Button>
              </SpaceBetween>
            }
          >
            Hosted zones
          </Header>
        }
        filter={
          <PropertyFilter
            {...propertyFilterProps}
            // The console shows "Use: Hosted zone name :" (Cloudscape's default adds quotes).
            i18nStrings={{ enteredTextLabel: (text) => `Use: ${text}` }}
            filteringPlaceholder="Filter records by property or value"
            filteringAriaLabel="Filter hosted zones"
            countText={hasFilter ? `${filteredItemsCount} matches` : undefined}
            expandToViewport
          />
        }
        pagination={<Pagination {...paginationProps} />}
        preferences={
          <CollectionPreferences
            title="Preferences"
            confirmLabel="Confirm"
            cancelLabel="Cancel"
            preferences={preferences}
            onConfirm={({ detail }) => setPreferences({ ...DEFAULT_PREFERENCES, ...detail })}
            pageSizePreference={{ title: "Page size", options: PAGE_SIZE_OPTIONS }}
            wrapLinesPreference={{ label: "Wrap lines", description: "Check to see all the text and wrap the lines." }}
            visibleContentPreference={VISIBLE_COLUMN_OPTIONS}
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
        }
        empty={emptyState}
      />
      {/* A deleted zone leaves the list on the refetch; a refused delete keeps it selected. */}
      {deleteOpen && selectedZone && <DeleteZoneModal zone={selectedZone} onClose={() => setDeleteOpen(false)} />}
    </div>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      title="Unable to load hosted zones"
      subtitle="The hosted zones could not be retrieved. Check that the backend is running."
      action={<Button onClick={onRetry}>Retry</Button>}
    />
  );
}
