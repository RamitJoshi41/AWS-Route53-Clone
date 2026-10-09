"use client";

// Pieces shared by the Create and Edit hosted zone pages.

import AttributeEditor from "@cloudscape-design/components/attribute-editor";
import Container from "@cloudscape-design/components/container";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import Textarea from "@cloudscape-design/components/textarea";

export const DESCRIPTION_MAX_LENGTH = 256;

/** Validation message for the description, as the console words it. */
export function descriptionError(description: string): string | undefined {
  return description.length > DESCRIPTION_MAX_LENGTH ? "Comment is too long." : undefined;
}

/** The console's "Info" links. They open the help panel, which comes with the UI polish phase. */
export function InfoLink() {
  return (
    <Link variant="info" onFollow={(event) => event.preventDefault()}>
      Info
    </Link>
  );
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
      info={<InfoLink />}
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
 * The Tags section. Tags aren't implemented yet, so it always shows the console's
 * empty state and "Add tag" does nothing.
 */
export function TagsSection() {
  return (
    <Container
      header={
        <Header
          variant="h2"
          info={<InfoLink />}
          description="Apply tags to hosted zones to help organize and identify them."
        >
          Tags
        </Header>
      }
    >
      <AttributeEditor
        items={[]}
        // Never rendered (there are no rows), but AttributeEditor needs its columns.
        definition={[
          { label: "Key", control: () => null },
          { label: "Value - optional", control: () => null },
        ]}
        empty="No tags associated with the resource."
        addButtonText="Add tag"
        additionalInfo="You can add up to 50 more tags."
        onAddButtonClick={() => {}}
      />
    </Container>
  );
}
