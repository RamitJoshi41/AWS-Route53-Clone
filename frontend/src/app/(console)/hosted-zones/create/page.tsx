"use client";

import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Tiles from "@cloudscape-design/components/tiles";
import { useRouter } from "next/navigation";
import { useState } from "react";

import VpcAssociations, { EMPTY_VPC_ROW, vpcRowErrors, type VpcRow } from "@/components/VpcAssociations";
import InfoLink from "@/components/InfoLink";
import { DescriptionField, TagsSection, descriptionError } from "@/components/ZoneFormParts";
import type { ZoneType } from "@/lib/api";
import { useConsolePage } from "@/lib/console-page";
import { apiErrorNotification, useNotifications } from "@/lib/notifications";
import { useCreateZone, useVpcCatalog } from "@/lib/zones";

const LIST_HREF = "/hosted-zones";

const VALID_CHARACTERS = "Valid characters: a-z, 0-9, ! \" # $ % & ' ( ) * + , - / : ; < = > ? @ [ \\ ] ^ _ ` { | } . ~";

export default function CreateHostedZonePage() {
  const router = useRouter();
  const { notify, replace, dismiss } = useNotifications();
  const createZone = useCreateZone();
  const catalog = useVpcCatalog();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ZoneType>("public");
  const [vpcRows, setVpcRows] = useState<VpcRow[]>([EMPTY_VPC_ROW]);
  // Like the console, errors appear after the first "Create" click, then update as you type.
  const [submitted, setSubmitted] = useState(false);
  // The error banner from the previous attempt, removed when the user tries again.
  const [errorNotificationId, setErrorNotificationId] = useState<string | null>(null);

  useConsolePage({
    helpTopic: "createHostedZone",
    breadcrumbs: [
      { text: "Hosted zones", href: LIST_HREF },
      { text: "Create hosted zone", href: "/hosted-zones/create" },
    ],
    contentType: "form",
  });

  // Client-side checks: only what the console checks before calling the API. Every
  // other rule (label format, duplicates, ...) is the backend's, shown as an error banner.
  const nameError = name.trim() === "" ? "Domain name is empty." : undefined;
  const descError = descriptionError(description);
  const vpcErrors = type === "private" ? vpcRowErrors(vpcRows) : [];
  const hasErrors = !!nameError || !!descError || vpcErrors.some((e) => e.region || e.vpcId);

  const submit = () => {
    setSubmitted(true);
    if (hasErrors || createZone.isPending) return;
    if (errorNotificationId) {
      dismiss(errorNotificationId);
      setErrorNotificationId(null);
    }

    // The console's messages use the name as typed (e.g. "testPrivate.com").
    const typedName = name.trim();
    const progressId = notify({
      type: "info",
      loading: true,
      header: `Creating hosted zone ${typedName}`,
      content: "This can take a moment.",
    });
    createZone.mutate(
      {
        name: typedName,
        type,
        description,
        vpcs:
          type === "private"
            ? vpcRows.map((row) => ({ region: row.region!, vpc_id: row.vpcId.trim() }))
            : [],
      },
      {
        onSuccess: (zone) => {
          replace(progressId, {
            type: "success",
            header: `${typedName} was successfully created.`,
            content:
              "Now you can create records in the hosted zone to specify how you want Route 53 to route traffic for your domain.",
          });
          router.push(`${LIST_HREF}/${zone.id}`);
        },
        onError: (error) => {
          // The "Creating..." banner turns into the error banner (same id).
          replace(progressId, apiErrorNotification(error));
          setErrorNotificationId(progressId);
        },
      },
    );
  };

  return (
    // A real <form>, so pressing Enter in the domain name field submits it.
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Form
        header={
          <Header variant="h1" info={<InfoLink topic="createHostedZone" />}>
            Create hosted zone
          </Header>
        }
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button formAction="none" variant="link" onClick={() => router.push(LIST_HREF)}>
              Cancel
            </Button>
            <Button variant="primary" loading={createZone.isPending}>
              Create hosted zone
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
                Hosted zone configuration
              </Header>
            }
          >
            <SpaceBetween size="l">
              <FormField
                label="Domain name"
                info={<InfoLink topic="domainName" />}
                description="This is the name of the domain that you want to route traffic for."
                constraintText={VALID_CHARACTERS}
                errorText={submitted ? nameError : undefined}
              >
                <Input
                  value={name}
                  onChange={({ detail }) => setName(detail.value)}
                  placeholder="example.com"
                  ariaLabel="Domain name"
                />
              </FormField>

              <DescriptionField
                value={description}
                onChange={setDescription}
                errorText={submitted ? descError : undefined}
              />

              <FormField
                label="Type"
                info={<InfoLink topic="zoneType" />}
                description="The type indicates whether you want to route traffic on the internet or in an Amazon VPC."
              >
                <Tiles
                  value={type}
                  onChange={({ detail }) => setType(detail.value as ZoneType)}
                  items={[
                    {
                      value: "public",
                      label: "Public hosted zone",
                      description: "A public hosted zone determines how traffic is routed on the internet.",
                    },
                    {
                      value: "private",
                      label: "Private hosted zone",
                      description: "A private hosted zone determines how traffic is routed within an Amazon VPC.",
                    },
                  ]}
                />
              </FormField>
            </SpaceBetween>
          </Container>

          {type === "private" && (
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
