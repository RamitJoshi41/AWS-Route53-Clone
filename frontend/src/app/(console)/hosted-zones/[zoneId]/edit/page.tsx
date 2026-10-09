"use client";

import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import { useRouter } from "next/navigation";
import { use, useState } from "react";

import VpcAssociations, { vpcRowErrors, type VpcRow } from "@/components/VpcAssociations";
import { Field } from "@/components/ZoneDetailsFields";
import { DescriptionField, InfoLink, TagsSection, descriptionError } from "@/components/ZoneFormParts";
import ZoneLoadError from "@/components/ZoneLoadError";
import type { HostedZone } from "@/lib/api";
import { useConsolePage } from "@/lib/console-page";
import { apiErrorNotification, useNotifications } from "@/lib/notifications";
import { displayName, useUpdateZone, useVpcCatalog, useZone, zoneTypeLong } from "@/lib/zones";

const LIST_HREF = "/hosted-zones";

export default function EditHostedZonePage({ params, searchParams }: PageProps<"/hosted-zones/[zoneId]/edit">) {
  const { zoneId } = use(params);
  // Opened from the details page ("?from=details") or from the list: Cancel and Save
  // go back to where the user came from, as in the console.
  const { from } = use(searchParams);
  const returnHref = from === "details" ? `${LIST_HREF}/${zoneId}` : LIST_HREF;

  const zoneQuery = useZone(zoneId);
  const loadedZone = zoneQuery.data;

  useConsolePage({
    breadcrumbs: [
      { text: "Hosted zones", href: LIST_HREF },
      { text: loadedZone ? displayName(loadedZone.name) : zoneId, href: `${LIST_HREF}/${zoneId}` },
      { text: "Edit", href: `${LIST_HREF}/${zoneId}/edit` },
    ],
    contentType: "form",
  });

  if (zoneQuery.isPending) {
    return <StatusIndicator type="loading">Loading hosted zone</StatusIndicator>;
  }
  if (zoneQuery.isError) {
    return <ZoneLoadError error={zoneQuery.error} onRetry={() => zoneQuery.refetch()} />;
  }
  return <EditZoneForm zone={zoneQuery.data} returnHref={returnHref} />;
}

/** The form itself, mounted once the zone is loaded so the description starts filled in. */
function EditZoneForm({ zone, returnHref }: { zone: HostedZone; returnHref: string }) {
  const router = useRouter();
  const { notify, dismiss } = useNotifications();
  const updateZone = useUpdateZone();

  const catalog = useVpcCatalog();
  const isPrivate = zone.type === "private";

  const [description, setDescription] = useState(zone.description ?? "");
  // A private zone's VPCs can be changed too (screenshot 29); the rows start as its current VPCs.
  const [vpcRows, setVpcRows] = useState<VpcRow[]>(() =>
    zone.vpcs.map((vpc) => ({ region: vpc.region, vpcId: vpc.vpc_id })),
  );
  // As on the create page: errors appear after the first save, then update as you type.
  const [submitted, setSubmitted] = useState(false);
  const [errorNotificationId, setErrorNotificationId] = useState<string | null>(null);

  const name = displayName(zone.name);
  const descError = descriptionError(description);
  const vpcErrors = isPrivate ? vpcRowErrors(vpcRows) : [];
  const hasErrors = !!descError || vpcErrors.some((e) => e.region || e.vpcId);

  const submit = () => {
    setSubmitted(true);
    if (hasErrors || updateZone.isPending) return;
    if (errorNotificationId) {
      dismiss(errorNotificationId);
      setErrorNotificationId(null);
    }
    updateZone.mutate(
      {
        id: zone.id,
        description,
        vpcs: isPrivate ? vpcRows.map((row) => ({ region: row.region!, vpc_id: row.vpcId.trim() })) : undefined,
      },
      {
        onSuccess: () => {
          notify({
            type: "success",
            header: `${name} was successfully updated.`,
            content: "Hosted zone details were successfully updated.",
          });
          router.push(returnHref);
        },
        onError: (error) => setErrorNotificationId(notify(apiErrorNotification(error))),
      },
    );
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Form
        header={
          <Header variant="h1" info={<InfoLink />}>
            Edit {name}
          </Header>
        }
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button formAction="none" variant="link" onClick={() => router.push(returnHref)}>
              Cancel
            </Button>
            <Button variant="primary" loading={updateZone.isPending}>
              Save changes
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="l">
          <Container
            header={
              <Header
                variant="h2"
                description="A hosted zone is a container that holds information about how you want to route traffic for a domain, such as example.com, and its subdomains."
              >
                Edit hosted zone
              </Header>
            }
          >
            {/* Name and type can't change after creation; only the description is editable. */}
            <SpaceBetween size="l">
              <Field label="Domain name">{name}</Field>
              <Field label="Hosted zone ID">{zone.id}</Field>
              <Field label="Record count">{zone.record_count}</Field>
              <Field label="Type">{zoneTypeLong(zone.type)}</Field>
              <DescriptionField
                value={description}
                onChange={setDescription}
                errorText={submitted ? descError : undefined}
              />
            </SpaceBetween>
          </Container>

          {isPrivate && (
            <VpcAssociations
              rows={vpcRows}
              onChange={setVpcRows}
              catalog={catalog.data}
              errors={submitted ? vpcErrors : []}
            />
          )}

          <TagsSection />
        </SpaceBetween>
      </Form>
    </form>
  );
}
