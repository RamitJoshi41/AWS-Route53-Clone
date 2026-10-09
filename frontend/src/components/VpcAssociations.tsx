"use client";

import Alert from "@cloudscape-design/components/alert";
import AttributeEditor from "@cloudscape-design/components/attribute-editor";
import Autosuggest from "@cloudscape-design/components/autosuggest";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import Select, { type SelectProps } from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useMemo, useState } from "react";

import { InfoLink } from "@/components/ZoneFormParts";
import type { VpcCatalog } from "@/lib/api";

/** One "Region | VPC ID" row as the user fills it in. */
export type VpcRow = { region: string | null; vpcId: string };

export type VpcRowErrors = { region?: string; vpcId?: string };

export const EMPTY_VPC_ROW: VpcRow = { region: null, vpcId: "" };

/**
 * Errors for the VPC rows, as the console reports them before calling the API:
 * every row needs both fields. Whether the VPC exists is the API's check
 * ("The VPC ID is invalid."), shown in the error banner.
 */
export function vpcRowErrors(rows: VpcRow[]): VpcRowErrors[] {
  return rows.map((row) => ({
    region: row.region ? undefined : "Region is empty.",
    vpcId: row.vpcId.trim() ? undefined : "VPC ID is empty.",
  }));
}

type Props = {
  rows: VpcRow[];
  onChange: (rows: VpcRow[]) => void;
  catalog: VpcCatalog | undefined;
  /** Shown only after the first submit attempt. */
  errors: VpcRowErrors[];
};

/** "VPCs to associate with the hosted zone": on the create and edit pages of private zones. */
export default function VpcAssociations({ rows, onChange, catalog, errors }: Props) {
  const [alertVisible, setAlertVisible] = useState(true);

  // "Asia Pacific (Mumbai)" with its code underneath, as in the console's dropdown.
  const regionOptions = useMemo<SelectProps.Option[]>(
    () => (catalog?.regions ?? []).map((r) => ({ label: r.name, value: r.code, description: r.code })),
    [catalog],
  );

  const updateRow = (index: number, change: Partial<VpcRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...change } : row)));

  return (
    <Container
      header={
        <Header
          variant="h2"
          info={<InfoLink />}
          description="To use this hosted zone to resolve DNS queries for one or more VPCs, choose the VPCs. To associate a VPC with a hosted zone when the VPC was created using a different AWS account, you must use a programmatic method, such as the AWS CLI."
        >
          VPCs to associate with the hosted zone
        </Header>
      }
    >
      <SpaceBetween size="l">
        {alertVisible && (
          <Alert type="info" dismissible onDismiss={() => setAlertVisible(false)}>
            For each VPC that you associate with a private hosted zone, you must set the Amazon VPC settings{" "}
            <Link external href="https://docs.aws.amazon.com/console/route53/vpc-dns-settings">
              enableDnsHostnames and enableDnsSupport
            </Link>{" "}
            to true.
          </Alert>
        )}
        <AttributeEditor
          items={rows}
          addButtonText="Add VPC"
          removeButtonText="Remove VPC"
          onAddButtonClick={() => onChange([...rows, EMPTY_VPC_ROW])}
          onRemoveButtonClick={({ detail }) => onChange(rows.filter((_, i) => i !== detail.itemIndex))}
          definition={[
            {
              label: "Region",
              info: <InfoLink />,
              errorText: (_, index) => errors[index]?.region,
              control: (row, index) => (
                <Select
                  placeholder="Choose region"
                  filteringType="auto"
                  options={regionOptions}
                  selectedOption={regionOptions.find((o) => o.value === row.region) ?? null}
                  // A new Region means the chosen VPC (from the old one) no longer applies.
                  onChange={({ detail }) => updateRow(index, { region: detail.selectedOption.value ?? null, vpcId: "" })}
                  statusType={catalog ? "finished" : "loading"}
                  loadingText="Loading Regions"
                />
              ),
            },
            {
              label: "VPC ID",
              info: <InfoLink />,
              errorText: (_, index) => errors[index]?.vpcId,
              control: (row, index) => (
                // Autosuggest renders a search-style input (magnifier + clear button), as in the console.
                <Autosuggest
                  placeholder="Choose VPC"
                  value={row.vpcId}
                  onChange={({ detail }) => updateRow(index, { vpcId: detail.value })}
                  options={(catalog?.vpcs ?? [])
                    .filter((vpc) => vpc.region === row.region)
                    .map((vpc) => ({ value: vpc.vpc_id }))}
                  empty="No VPCs found"
                  hideEnteredTextOption
                  clearAriaLabel="Clear VPC"
                  ariaLabel="VPC ID"
                />
              ),
            },
          ]}
        />
      </SpaceBetween>
    </Container>
  );
}
