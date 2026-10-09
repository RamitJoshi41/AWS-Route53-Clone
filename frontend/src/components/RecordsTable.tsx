"use client";

import { useCollection } from "@cloudscape-design/collection-hooks";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Header from "@cloudscape-design/components/header";
import Pagination from "@cloudscape-design/components/pagination";
import PropertyFilter, { type PropertyFilterProps } from "@cloudscape-design/components/property-filter";
import Select, { type SelectProps } from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table, { type TableProps } from "@cloudscape-design/components/table";
import { useMemo, useRef, useState } from "react";

import TablePreferences, { SearchModeDescription, type TablePreferencesValue } from "@/components/TablePreferences";
import { InfoLink } from "@/components/ZoneFormParts";
import type { DnsRecord } from "@/lib/api";
import { isProtectedRecord } from "@/lib/records";
import { displayName } from "@/lib/zones";

import styles from "./RecordsTable.module.css";

/** A record as a table row, with the text each column shows (for sorting and filtering). */
export type RecordRow = {
  id: number;
  name: string;
  type: string;
  routingPolicy: string;
  differentiator: string;
  alias: string;
  values: string[];
  value: string;
  ttl: number;
  healthCheckId: string;
  evaluateTargetHealth: string;
  recordId: string;
};

export function toRecordRow(record: DnsRecord): RecordRow {
  return {
    id: record.id,
    name: displayName(record.name),
    type: record.type,
    // Routing policies, aliases and health checks aren't modelled yet: every record is a
    // simple, non-alias record, which is what the console shows for these.
    routingPolicy: "Simple",
    differentiator: "-",
    alias: "No",
    values: record.values,
    value: record.values.join(" "),
    ttl: record.ttl,
    healthCheckId: "-",
    evaluateTargetHealth: "-",
    recordId: "-",
  };
}

// The three dropdowns next to the search box (records_search screenshots). Choosing a
// value adds a "Property = value" token to the search; each list is fixed, whatever
// records the zone holds, and has no "any" entry: removing the token clears the dropdown.
type DropdownKey = "type" | "routingPolicy" | "alias";
const DROPDOWN_FILTERS: { key: DropdownKey; placeholder: string; options: SelectProps.Option[]; searchable: boolean }[] = [
  {
    key: "type",
    placeholder: "Type",
    options: [
      "A", "AAAA", "CNAME", "MX", "TXT", "PTR", "SRV", "SPF", "NAPTR",
      "CAA", "NS", "SOA", "DS", "TLSA", "SSHFP", "HTTPS", "SVCB",
    ].map((type) => ({ value: type, label: type })),
    searchable: true,
  },
  {
    key: "routingPolicy",
    placeholder: "Routing policy",
    options: [
      "Simple", "Weighted", "Geolocation", "Latency", "Failover",
      "Multivalue answer", "IP-based", "Geoproximity location",
    ].map((policy) => ({ value: policy, label: policy })),
    searchable: true,
  },
  {
    key: "alias",
    placeholder: "Alias",
    // "Non-alias" (token "Alias = No") is in the screenshots; "Alias" is its counterpart.
    options: [
      { value: "Yes", label: "Alias" },
      { value: "No", label: "Non-alias" },
    ],
    searchable: false,
  },
];

const PROPERTY_LABELS: [string, string][] = [
  ["name", "Record name"],
  ["type", "Type"],
  ["routingPolicy", "Routing policy"],
  ["differentiator", "Differentiator"],
  ["alias", "Alias"],
  ["value", "Value/Route traffic to"],
  ["ttl", "TTL (seconds)"],
  ["healthCheckId", "Health check ID"],
  ["evaluateTargetHealth", "Evaluate target health"],
  ["recordId", "Record ID"],
];

// What the search box offers: "contains" only, so picking a property fills in "Property : ".
const FILTERING_PROPERTIES: PropertyFilterProps.FilteringProperty[] = PROPERTY_LABELS.map(([key, propertyLabel]) => ({
  key,
  propertyLabel,
  groupValuesLabel: "values",
  operators: [":"],
  defaultOperator: ":",
}));

// What the filtering logic accepts: also "equals" for the dropdown properties, because a
// token whose operator its property doesn't list matches nothing.
const MATCHING_PROPERTIES: PropertyFilterProps.FilteringProperty[] = FILTERING_PROPERTIES.map((property) =>
  DROPDOWN_FILTERS.some(({ key }) => key === property.key) ? { ...property, operators: [":", "="] } : property,
);

// The Preferences dialog (screenshot 28): every column can be hidden; all start visible,
// 100 rows per page.
const COLUMN_OPTIONS = PROPERTY_LABELS.map(([id, label]) => ({ id, label }));
const DEFAULT_PREFERENCES: TablePreferencesValue = {
  pageSize: 100,
  wrapLines: false,
  visibleContent: COLUMN_OPTIONS.map(({ id }) => id),
  custom: "automatic",
};

// Starting widths measured from the console (screenshot 01); every column can be resized.
const COLUMNS: TableProps.ColumnDefinition<RecordRow>[] = [
  { id: "name", header: "Record name", cell: (r) => r.name, sortingField: "name", isRowHeader: true, width: 300 },
  { id: "type", header: "Type", cell: (r) => r.type, sortingField: "type", width: 90 },
  { id: "routingPolicy", header: "Routing policy", cell: (r) => r.routingPolicy, sortingField: "routingPolicy", width: 120 },
  {
    id: "differentiator",
    header: "Differentiator",
    cell: (r) => r.differentiator,
    sortingField: "differentiator",
    width: 110,
  },
  { id: "alias", header: "Alias", cell: (r) => r.alias, sortingField: "alias", width: 110 },
  {
    id: "value",
    header: "Value/Route traffic to",
    // One value per line, as in the console (an NS record lists its 4 name servers).
    cell: (r) => r.values.map((value, i) => <div key={i}>{value}</div>),
    sortingField: "value",
    width: 240,
  },
  // Locale-formatted like the console ("1,72,800" in an en-IN browser).
  { id: "ttl", header: "TTL (seconds)", cell: (r) => r.ttl.toLocaleString(), sortingField: "ttl", width: 110 },
  { id: "healthCheckId", header: "Health check ID", cell: (r) => r.healthCheckId, sortingField: "healthCheckId", width: 120 },
  {
    id: "evaluateTargetHealth",
    header: "Evaluate target health",
    cell: (r) => r.evaluateTargetHealth,
    sortingField: "evaluateTargetHealth",
    width: 115,
  },
  { id: "recordId", header: "Record ID", cell: (r) => r.recordId, sortingField: "recordId", width: 115 },
];

type Props = {
  /** The zone's normalized name ("example.com."): its SOA and NS records named like it can't be deleted. */
  zoneName: string;
  records: DnsRecord[];
  loading: boolean;
  onRefresh: () => void;
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  /** "Delete record" for the selection; the confirmation dialog arrives with record deletion. */
  onDeleteSelected?: () => void;
};

/** The "Records" tab of a hosted zone. */
export default function RecordsTable({
  zoneName,
  records,
  loading,
  onRefresh,
  selectedIds,
  onSelectionChange,
  onDeleteSelected,
}: Props) {
  const rows = useMemo(() => records.map(toRecordRow), [records]);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  // Lets "To change modes go to settings." find the table's Preferences button.
  const tableWrapper = useRef<HTMLDivElement>(null);

  const { items, actions, filteredItemsCount, collectionProps, propertyFilterProps, paginationProps } =
    useCollection(rows, {
      propertyFiltering: { filteringProperties: MATCHING_PROPERTIES },
      sorting: {},
      pagination: { pageSize: preferences.pageSize },
    });

  const query = propertyFilterProps.query;
  const tokens = query.tokens ?? [];
  const equalsToken = (key: DropdownKey) =>
    tokens.find((token) => token.propertyKey === key && token.operator === "=");
  // Sets the dropdown's "=" token: replaced where it stands, or added at the end.
  const chooseDropdownValue = (key: DropdownKey, value: string) => {
    const token = { propertyKey: key, operator: "=", value };
    const current = equalsToken(key);
    const next = current ? tokens.map((t) => (t === current ? token : t)) : [...tokens, token];
    actions.setPropertyFiltering({ ...query, tokens: next });
  };

  const selectedItems = rows.filter((row) => selectedIds.includes(row.id));
  // Selecting the SOA record or the apex NS record disables "Delete record" and swaps the
  // description for the console's explanation (screenshots 06, 07).
  const selectsProtected = records.some(
    (record) => selectedIds.includes(record.id) && isProtectedRecord(record, zoneName),
  );
  const countText = tokens.length > 0 ? `${filteredItemsCount} matches` : undefined;
  const clearFilters = () => actions.setPropertyFiltering({ tokens: [], operation: "and" });

  return (
    <div ref={tableWrapper}>
      <Table
        {...collectionProps}
        items={loading ? [] : items}
        columnDefinitions={COLUMNS}
        trackBy="id"
        selectionType="multi"
        selectedItems={selectedItems}
        onSelectionChange={({ detail }) => onSelectionChange(detail.selectedItems.map((row) => row.id))}
        loading={loading}
        loadingText="Loading records"
        skeleton={{ totalRows: 3 }}
        resizableColumns
        wrapLines={preferences.wrapLines}
        visibleColumns={preferences.visibleContent}
        ariaLabels={{
          selectionGroupLabel: "Record selection",
          itemSelectionLabel: (_, row) => `${row.name} ${row.type}`,
          allItemsSelectionLabel: () => "Select all records",
        }}
        header={
          <Header
            counter={selectedItems.length ? `(${selectedItems.length}/${rows.length})` : `(${rows.length})`}
            info={<InfoLink />}
            description={
              selectsProtected ? (
                `The following table lists the existing records in ${displayName(zoneName)}. ` +
                `You can't delete the SOA record or the NS record named ${displayName(zoneName)}.`
              ) : (
                <SearchModeDescription mode={preferences.custom} tableRef={tableWrapper} />
              )
            }
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" ariaLabel="Refresh records" loading={loading} onClick={onRefresh} />
                <Button disabled={selectedItems.length === 0 || selectsProtected} onClick={onDeleteSelected}>
                  Delete record
                </Button>
                <Button>Import zone file</Button>
                <Button variant="primary">Create record</Button>
              </SpaceBetween>
            }
          >
            Records
          </Header>
        }
        filter={
          <div className={styles.container}>
            <div className={styles.filters}>
              <div className={styles.search}>
                <PropertyFilter
                  {...propertyFilterProps}
                  filteringProperties={FILTERING_PROPERTIES}
                  i18nStrings={{ enteredTextLabel: (text) => `Use: ${text}` }}
                  filteringPlaceholder="Filter records by property or value"
                  filteringAriaLabel="Filter records"
                  countText={countText}
                  expandToViewport
                />
              </div>
              <div className={styles.dropdowns}>
                {DROPDOWN_FILTERS.map(({ key, placeholder, options, searchable }) => {
                  const value = equalsToken(key)?.value;
                  return (
                    <div key={key} className={styles.dropdown}>
                      <Select
                        placeholder={placeholder}
                        ariaLabel={`Filter by ${placeholder.toLowerCase()}`}
                        options={options}
                        selectedOption={options.find((option) => option.value === value) ?? null}
                        onChange={({ detail }) => chooseDropdownValue(key, detail.selectedOption.value ?? "")}
                        filteringType={searchable ? "auto" : "none"}
                        expandToViewport
                      />
                    </div>
                  );
                })}
                {countText && <span className={styles.matchCount}>{countText}</span>}
              </div>
            </div>
          </div>
        }
        pagination={<Pagination {...paginationProps} />}
        preferences={
          <TablePreferences
            preferences={preferences}
            defaults={DEFAULT_PREFERENCES}
            columns={COLUMN_OPTIONS}
            onConfirm={setPreferences}
          />
        }
        empty={
          <Box textAlign="center" color="inherit">
            <Box variant="strong" textAlign="center" color="inherit">
              No matches
            </Box>
            <Box variant="p" padding={{ bottom: "s" }} color="inherit">
              No results match your query.
            </Box>
            <Button onClick={clearFilters}>Clear filters</Button>
          </Box>
        }
      />
    </div>
  );
}
