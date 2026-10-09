import AuthGuard from "@/components/AuthGuard";
import ConsoleShell from "@/components/ConsoleShell";
import { ConsolePageProvider } from "@/lib/console-page";
import { HelpProvider } from "@/lib/help";
import { NotificationsProvider } from "@/lib/notifications";

// Shell for every signed-in page. "(console)" is a route group: it shares this layout
// without adding a URL segment. /login sits outside the group and therefore outside
// the guard. Being a layout, it stays mounted while you move between console pages,
// so the side navigation and flash messages persist across navigation.
export default function ConsoleLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthGuard>
      <NotificationsProvider>
        <ConsolePageProvider>
          <HelpProvider>
            <ConsoleShell>{children}</ConsoleShell>
          </HelpProvider>
        </ConsolePageProvider>
      </NotificationsProvider>
    </AuthGuard>
  );
}
