// The help panel's content, one entry per topic. Each page opens its default topic
// from the toolbar's (i) button; "Info" links open the topic next to them.
//
// Texts follow the console's help panels in docs/reference (help_*.png and
// "Hosted Zones search format and help panel.png"). Topics without a screenshot,
// and the endings the screenshots cut off, are short texts written from the
// Route 53 Developer Guide (listed in docs/DECISIONS.md).

import type { ReactNode } from "react";

export type HelpTopicContent = {
  header: string;
  content: ReactNode;
  /** "Learn more" links (AWS documentation). */
  links?: { text: string; href: string }[];
};

const GUIDE = "https://docs.aws.amazon.com/Route53/latest/DeveloperGuide";

const LINKS = {
  workingWithRecords: { text: "Working with records", href: `${GUIDE}/rrsets-working-with.html` },
  recordTypes: { text: "Supported DNS record types", href: `${GUIDE}/ResourceRecordTypes.html` },
  cnames: {
    text: "Use custom URLs by adding alternate domain names (CNAMEs)",
    href: "https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/CNAMEs.html",
  },
  aliasOrNot: {
    text: "Choosing between alias and non-alias records",
    href: `${GUIDE}/resource-record-sets-choosing-alias-non-alias.html`,
  },
  routingPolicies: { text: "Choosing a routing policy", href: `${GUIDE}/routing-policy.html` },
  hostedZones: { text: "Working with hosted zones", href: `${GUIDE}/hosted-zones-working-with.html` },
  publicZones: { text: "Working with public hosted zones", href: `${GUIDE}/AboutHZWorkingWith.html` },
  privateZones: { text: "Working with private hosted zones", href: `${GUIDE}/hosted-zones-private.html` },
  routing: {
    text: "How internet traffic is routed to your website or web application",
    href: `${GUIDE}/welcome-dns-service.html`,
  },
  tags: { text: "Tagging hosted zones", href: `${GUIDE}/hosted-zone-tags.html` },
  acceleratedRecovery: {
    text: "Accelerated recovery for public DNS records",
    href: `${GUIDE}/accelerated-recovery.html`,
  },
  dnssec: { text: "Configuring DNSSEC signing in Amazon Route 53", href: `${GUIDE}/dns-configuring-dnssec.html` },
  getChange: {
    text: "GetChange (Route 53 API Reference)",
    href: "https://docs.aws.amazon.com/Route53/latest/APIReference/API_GetChange.html",
  },
};

export const HELP_TOPICS = {
  hostedZoneDetails: {
    header: "Hosted zone details",
    content: (
      <>
        <p>The details page for a hosted zone include the following information:</p>
        <ul>
          <li>
            <b>Hosted zone ID</b>: Route 53 assigns the ID when you create a hosted zone. The main use for this ID
            is programmatic access to the hosted zone.
          </li>
          <li>
            <b>Description</b>: In the list of hosted zones, this value lets you distinguish hosted zones that have
            the same name. A description is optional.
          </li>
          <li>
            <b>Type</b>: The type specifies whether this is a public hosted zone (for routing traffic on the
            internet) or a private hosted zone (for routing traffic within and among VPCs).
          </li>
          <li>
            <b>Name servers</b>: Route 53 assigns name servers when you create a hosted zone. The assigned name
            servers can&apos;t be changed.
            <p>
              To make Route 53 the DNS service for a domain (to use the records in a public hosted zone to route
              traffic on the internet for a domain), you update the domain registration to use these name servers.
            </p>
          </li>
          <li>
            <b>Record count</b>: The total number of records in a hosted zone, including the default NS and SOA
            records.
          </li>
        </ul>
      </>
    ),
    links: [LINKS.hostedZones],
  },

  createHostedZone: {
    header: "Create hosted zone",
    content: (
      <>
        <p>
          You create a hosted zone when you want to use Route 53 to route internet traffic for your domain or to
          route traffic within your VPCs. Then you create records in the hosted zone for the domain name
          (example.com) and subdomains (such as www.example.com or blog.example.com).
        </p>
        <p>
          When you register a domain with Route 53, a public hosted zone is automatically created. You can also
          create a new hosted zone for a subdomain. Using a separate hosted zone to route internet traffic for a
          subdomain is sometimes known as &quot;delegating responsibility for a subdomain to a hosted zone&quot; or
          &quot;delegating a subdomain to other name servers&quot;.
        </p>
        <p>
          When you want to route traffic to your VPCs you create a private hosted zone for your domain and
          associate a VPC to it. This is sometimes referred to as &quot;private DNS&quot;.
        </p>
      </>
    ),
    links: [LINKS.publicZones, LINKS.privateZones, LINKS.routing],
  },

  editHostedZone: {
    header: "Edit hosted zone",
    content: (
      <>
        <p>
          You can change the description of a hosted zone. For a private hosted zone, you can also change the VPCs
          that are associated with it.
        </p>
        <p>
          You can&apos;t change the name or the type of a hosted zone. To use a different name or type, create a
          new hosted zone.
        </p>
      </>
    ),
    links: [LINKS.publicZones, LINKS.privateZones],
  },

  domainName: {
    header: "Domain name",
    content: (
      <>
        <p>
          Enter the name of the domain that you want to route traffic for, such as <b>example.com</b>. You can also
          enter a subdomain, such as <b>acme.example.com</b>, to route traffic for it with a separate hosted zone.
        </p>
        <p>
          For a public hosted zone, the domain doesn&apos;t have to be registered with Route 53. Internet traffic is
          routed by this hosted zone after you update the domain&apos;s registration to use its name servers.
        </p>
      </>
    ),
    links: [LINKS.publicZones],
  },

  description: {
    header: "Description",
    content: (
      <p>
        An optional description of up to 256 characters. In the list of hosted zones, this value lets you
        distinguish hosted zones that have the same name.
      </p>
    ),
  },

  zoneType: {
    header: "Type",
    content: (
      <ul>
        <li>
          <b>Public hosted zone</b>: Determines how traffic is routed on the internet.
        </li>
        <li>
          <b>Private hosted zone</b>: Determines how traffic is routed within the Amazon VPCs that you associate
          with the hosted zone.
        </li>
      </ul>
    ),
    links: [LINKS.publicZones, LINKS.privateZones],
  },

  vpcs: {
    header: "VPCs to associate with the hosted zone",
    content: (
      <>
        <p>
          A private hosted zone answers DNS queries only from the VPCs that are associated with it. Choose the
          Region and the ID of each VPC. A private hosted zone needs at least one VPC.
        </p>
        <p>You can associate more VPCs, or remove them, later by editing the hosted zone.</p>
      </>
    ),
    links: [LINKS.privateZones],
  },

  tags: {
    header: "Tags",
    content: (
      <p>
        A tag is a label that you assign to an AWS resource. Each tag consists of a key and an optional value. You
        can use tags to organize your hosted zones, for example by environment or owner, and to track costs.
      </p>
    ),
    links: [LINKS.tags],
  },

  records: {
    header: "Records",
    content: (
      <>
        <p>
          The records in a hosted zone define how you want to route traffic for the domain and its subdomains. When
          you create a hosted zone, Route 53 automatically creates a name server (NS) record and a start of
          authority (SOA) record for the zone.
        </p>
        <p>
          You can&apos;t delete the SOA record or the NS record that has the same name as the hosted zone. To edit
          or delete other records, select them in the table.
        </p>
      </>
    ),
    links: [LINKS.workingWithRecords, LINKS.recordTypes],
  },

  configureRecords: {
    header: "Configure records",
    content: (
      <>
        <p>
          Each record in a hosted zone defines how you want Route 53 to respond to DNS queries. You can specify the
          settings for multiple records and then create them all at one time.
        </p>
        <p>
          This is especially useful when you create multiple records that have a routing policy other than simple
          because you can specify the name, type, and TTL just once. You also can review the record values, such
          as IP addresses or weights, before you create the records.
        </p>
      </>
    ),
    links: [LINKS.workingWithRecords, LINKS.recordTypes, LINKS.cnames],
  },

  recordName: {
    header: "Record name",
    content: (
      <>
        <p>
          To route traffic for the name of the domain, such as example.com, leave the <b>Record name</b> field
          blank. The default value is the name of the hosted zone.
        </p>
        <p>
          To route traffic for a subdomain, such as www.example.com, enter the subdomain name but without the
          domain name. For example, to route traffic for www.example.com, enter only <b>www</b>.
        </p>
      </>
    ),
    links: [LINKS.workingWithRecords],
  },

  recordType: {
    header: "Record type",
    content: (
      <p>
        Choose the applicable DNS record type. When routing traffic to an AWS resource, the only record types
        available are the record types that are applicable to that resource.
      </p>
    ),
    links: [LINKS.workingWithRecords, LINKS.recordTypes],
  },

  value: {
    header: "Value/route traffic to",
    content: (
      <>
        <p>
          For <b>Value/route traffic to</b>, choose the applicable value:
        </p>
        <ul>
          <li>
            <b>To route traffic to an AWS resource that appears in the list</b>: choose the type of the resource,
            such as a CloudFront distribution or an Amazon S3 website endpoint. Then specify the applicable values,
            such as the AWS Region where you created the resource, and the resource that you want to route traffic
            to.
          </li>
          <li>
            <b>To route traffic to a type of AWS resource that isn&apos;t listed</b>: choose{" "}
            <b>IP address or another value depending on the record type</b>. Then specify the applicable value,
            such as an Amazon EC2 Elastic IP address.
          </li>
          <li>
            <b>To create other types of records, such as TXT records</b>: choose{" "}
            <b>IP address or another value depending on the record type</b>. Then specify the applicable value,
            such as an Amazon EC2 Elastic IP address.
          </li>
        </ul>
        <p>
          Choose <b>Alias</b> if you want to route traffic to selected AWS resources, such as CloudFront
          distributions and Amazon S3 buckets, or if you want to route traffic from one record in a hosted zone to
          another record. If you don&apos;t see your resource in the list, make sure you check the AWS Region is the
          same as where the resource you want to route traffic to was created.
        </p>
        <p>
          If your alias record points to an AWS resource or another record in the same hosted zone, you can&apos;t
          set the time to live (TTL). This is because Route 53 uses the default TTL for the resource or the record
          that the alias record points to.
        </p>
      </>
    ),
    links: [LINKS.workingWithRecords, LINKS.aliasOrNot],
  },

  ttl: {
    header: "TTL (time to live)",
    content: (
      <>
        <p>
          The amount of time, in seconds, that you want DNS recursive resolvers to cache information about this
          record. If you specify a longer value (for example, 172800 seconds, or two days), you reduce the number
          of calls that DNS recursive resolvers must make to Route 53 to get the latest information in this record.
          This has the effect of reducing latency and reducing your bill for Route 53 service.
        </p>
        <p>
          However, if you specify a longer value for TTL, it takes longer for changes to the record (for example, a
          new IP address) to take effect because recursive resolvers use the values in their cache for longer
          periods before they ask Route 53 for the latest information.
        </p>
        <p>
          If you&apos;re associating this record with a health check, we recommend that you specify a TTL of 60
          seconds or less so clients respond quickly to changes in health status.
        </p>
        <p>
          Most alias records use a default TTL value. However, if the alias record points to another record in the
          same hosted zone, the alias record&apos;s TTL will match the TTL of the record it points to.
        </p>
      </>
    ),
    links: [LINKS.workingWithRecords, LINKS.aliasOrNot],
  },

  routingPolicy: {
    header: "Choose routing policy",
    content: (
      <>
        <p>
          Routing policies let you choose how Route 53 routes traffic to your resources. If you have multiple
          resources that perform the same operation, such as serve content for a website, choose a routing policy
          other than simple. Here&apos;s a brief comparison:
        </p>
        <ul>
          <li>
            <b>Simple</b>: Simple records use standard DNS functionality.
          </li>
          <li>
            <b>Weighted</b>: Weighted records let you specify what portion of traffic to send to each resource.
          </li>
          <li>
            <b>Geolocation</b>: Geolocation records let you route traffic to your resources based on the geographic
            location of your users.
          </li>
          <li>
            <b>Latency</b>: Latency records let you route traffic to resources in the AWS Region that provides the
            lowest latency. All resources must be in AWS Regions.
          </li>
          <li>
            <b>IP-based</b>: IP-based records let you route traffic to resources based on their IP-addresses that
            you know.
          </li>
          <li>
            <b>Failover</b>: Failover records let you route traffic to a resource when the resource is healthy or
            to a different resource when the first resource is unhealthy.
          </li>
          <li>
            <b>Multivalue answer</b>: Multivalue answer records let you configure Route 53 to return multiple
            values, such as IP addresses for your web servers, in response to DNS queries.
          </li>
          <li>
            <b>Geoproximity</b>: Geoproximity records let you configure Route 53 to route traffic to your resources
            based on the geographic location of your users and your resources.
          </li>
        </ul>
      </>
    ),
    links: [LINKS.routingPolicies],
  },

  acceleratedRecovery: {
    header: "Accelerated recovery",
    content: (
      <p>
        With accelerated recovery, you can continue to make changes to the public DNS records in this hosted zone
        even if the Route 53 control plane in US East (N. Virginia) is impaired. Not available in this clone.
      </p>
    ),
    links: [LINKS.acceleratedRecovery],
  },

  dnssecSigning: {
    header: "DNSSEC signing",
    content: (
      <>
        <p>
          DNSSEC signing lets DNS resolvers validate that a DNS response came from Route 53 and hasn&apos;t been
          tampered with. Route 53 signs the records in the hosted zone with a key-signing key (KSK) that is based
          on a customer managed key in AWS KMS.
        </p>
        <p>Not available in this clone.</p>
      </>
    ),
    links: [LINKS.dnssec],
  },

  changeInfo: {
    header: "Change status",
    content: (
      <>
        <p>
          When you create or edit records, Route 53 submits the change and propagates it to all of its
          authoritative DNS servers. While that is in progress, the status is <b>PENDING</b>.
        </p>
        <p>
          When propagation is finished, the status changes to <b>INSYNC</b>. Changes generally propagate to all
          Route 53 name servers within 60 seconds.
        </p>
      </>
    ),
    links: [LINKS.getChange],
  },
} satisfies Record<string, HelpTopicContent>;

export type HelpTopic = keyof typeof HELP_TOPICS;
