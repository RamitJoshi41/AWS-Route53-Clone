import Box from "@cloudscape-design/components/box";

import AuthGuard from "@/components/AuthGuard";
import ConsoleTopNav from "@/components/ConsoleTopNav";

// Shell for every signed-in page. "(console)" is a route group: it shares this layout
// without adding a URL segment, so this page is still served at "/". /login sits
// outside the group and therefore outside the guard.
export default function ConsoleLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthGuard>
      <ConsoleTopNav />
      <Box padding="l">{children}</Box>
    </AuthGuard>
  );
}
