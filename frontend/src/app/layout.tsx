import type { Metadata } from "next";
// Cloudscape's global CSS: normalize, Open Sans fonts and design tokens. Imported once, here.
import "@cloudscape-design/global-styles/index.css";

import Providers from "./providers";

export const metadata: Metadata = {
  title: {
    default: "Route 53 | Global",
    template: "%s | Route 53 | Global",
  },
  description: "AWS Route 53 console clone",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      {/* Browser extensions often inject attributes on <body> before hydration (e.g. class="vc-init").
          This only silences attribute mismatches on <body> itself, not inside {children}. */}
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
