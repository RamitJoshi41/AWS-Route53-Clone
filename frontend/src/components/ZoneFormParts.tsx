"use client";

// Pieces shared by the Create and Edit hosted zone pages.

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";

import ComingSoonPopover from "@/components/ComingSoonPopover";
import InfoLink from "@/components/InfoLink";

export const DESCRIPTION_MAX_LENGTH = 256;

/** Validation message for the description, as the console words it. */
export function descriptionError(description: string): string | undefined {
  return description.length > DESCRIPTION_MAX_LENGTH ? "Comment is too long." : undefined;
}

type DescriptionFieldProps = {
  value: string;
  onChange: (value: string) => void;
  errorText?: string;
};

export function DescriptionField({ value, onChange, errorText }: DescriptionFieldProps) {
  return (
    <FormField
      label={
        <>
          Description - <i>optional</i>
        </>
      }
      info={<InfoLink topic="description" />}
      description="This value lets you distinguish hosted zones that have the same name."
      constraintText={`The description can have up to ${DESCRIPTION_MAX_LENGTH} characters. ${value.length}/${DESCRIPTION_MAX_LENGTH}`}
      errorText={errorText}
    >
      {/* No maxLength: like the console, extra text can be typed and is reported as an error. */}
      <Textarea
        value={value}
        onChange={({ detail }) => onChange(detail.value)}
        placeholder="The hosted zone is used for..."
        rows={3}
      />
    </FormField>
  );
}

/**
 * The Tags section. Tags aren't implemented, so it shows the console's empty state
 * (the AttributeEditor layout: message, "Add tag", limit), and "Add tag" opens the
 * "not available" popover.
 */
export function TagsSection() {
  return (
    <Container
      header={
        <Header
          variant="h2"
          info={<InfoLink topic="tags" />}
          description="Apply tags to hosted zones to help organize and identify them."
        >
          Tags
        </Header>
      }
    >
      <SpaceBetween size="m">
        <Box color="text-status-inactive">No tags associated with the resource.</Box>
        <div>
          <ComingSoonPopover feature="Tags">
            <Button>Add tag</Button>
          </ComingSoonPopover>
          <Box variant="small" display="block" color="text-body-secondary" padding={{ top: "xxs" }}>
            You can add up to 50 more tags.
          </Box>
        </div>
      </SpaceBetween>
    </Container>
  );
}
