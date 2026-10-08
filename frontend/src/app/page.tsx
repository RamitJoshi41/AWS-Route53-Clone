import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";

import BackendStatus from "@/components/BackendStatus";

// Temporary landing page for Phase 1. Replaced by the console shell in Phase 5.
export default function Home() {
  return (
    <ContentLayout header={<Header variant="h1">Route 53</Header>}>
      <BackendStatus />
    </ContentLayout>
  );
}
