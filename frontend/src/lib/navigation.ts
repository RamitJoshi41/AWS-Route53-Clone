// The Route 53 side navigation, mirroring the console's structure. Plain data, so
// both the client shell (which renders it) and the server "Coming soon" page (which
// checks a URL against it) can import it.

export type NavLink = {
  text: string;
  href: string;
  /** Shows the blue "New" label next to the link; clicking it opens this popover. */
  newLabel?: { header: string; content: string };
  /** Shows the external-link icon. The console opens these in another service. */
  external?: boolean;
  /** Built in this app. Every other link shows the "Coming soon" page. */
  implemented?: boolean;
};

export type NavSection = { section: string; links: NavLink[] };

export type NavEntry = NavLink | NavSection | "divider";

export const NAVIGATION: NavEntry[] = [
  { text: "Dashboard", href: "/dashboard" },
  { text: "Hosted zones", href: "/hosted-zones", implemented: true },
  { text: "Health checks", href: "/health-checks" },
  { text: "Profiles", href: "/profiles" },
  {
    section: "Global Resolver",
    links: [
      {
        text: "Global resolvers",
        href: "/global-resolvers",
        newLabel: {
          header: "Introducing global resolvers",
          content: "Secure and reliable global DNS resolution for public and private domains.",
        },
      },
      {
        text: "Shared DNS views",
        href: "/shared-dns-views",
        newLabel: {
          header: "Shared DNS views",
          content:
            "View and manage DNS views shared with your account through AWS Resource Access Manager (RAM).",
        },
      },
    ],
  },
  {
    section: "VPC Resolver",
    links: [
      { text: "VPCs", href: "/resolver/vpcs" },
      { text: "Inbound endpoints", href: "/resolver/inbound-endpoints" },
      { text: "Outbound endpoints", href: "/resolver/outbound-endpoints" },
      { text: "Rules", href: "/resolver/rules" },
      { text: "Query logging", href: "/resolver/query-logging" },
      { text: "Outposts", href: "/resolver/outposts" },
    ],
  },
  {
    section: "Domains",
    links: [
      { text: "Registered domains", href: "/domains/registered-domains" },
      { text: "Requests", href: "/domains/requests" },
    ],
  },
  {
    section: "IP-based routing",
    links: [{ text: "CIDR collections", href: "/cidr-collections" }],
  },
  {
    section: "Traffic flow",
    links: [
      { text: "Traffic policies", href: "/traffic-policies" },
      { text: "Policy records", href: "/policy-records" },
    ],
  },
  "divider",
  { text: "DNS Firewall", href: "/dns-firewall", external: true },
  { text: "Application Recovery Controller", href: "/application-recovery-controller", external: true },
];

/** Every nav link, flattened (sections removed). */
export const NAV_LINKS: NavLink[] = NAVIGATION.flatMap((entry) =>
  entry === "divider" ? [] : "section" in entry ? entry.links : [entry],
);

/** The nav link a "Coming soon" URL belongs to, or undefined for unknown URLs (a 404). */
export function findPlaceholderLink(pathname: string): NavLink | undefined {
  return NAV_LINKS.find((link) => link.href === pathname && !link.implemented);
}
