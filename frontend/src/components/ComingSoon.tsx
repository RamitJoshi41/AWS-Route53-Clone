"use client";

import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";

import { useConsolePage } from "@/lib/console-page";

/** Placeholder for console sections that aren't built in this clone. */
export default function ComingSoon({ title }: { title: string }) {
  useConsolePage({ breadcrumbs: [{ text: title, href: "#" }] });

  return (
    <ContentLayout header={<Header variant="h1">{title}</Header>}>
      <Container>
        <Box textAlign="center" padding={{ vertical: "xxl" }} color="text-body-secondary">
          <Box variant="h2" color="inherit" padding={{ bottom: "s" }}>
            Coming soon
          </Box>
          {title} is not available in this Route 53 clone yet.
        </Box>
      </Container>
    </ContentLayout>
  );
}
