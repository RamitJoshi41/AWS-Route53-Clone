import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";

import BackendStatus from "@/components/BackendStatus";

// Temporary landing page (protected by the (console) layout). Replaced by the console
// shell in Phase 5.
export default function Home() {
  return (
    <ContentLayout header={<Header variant="h1">Route 53</Header>}>
      <BackendStatus />
    </ContentLayout>
  );
}
