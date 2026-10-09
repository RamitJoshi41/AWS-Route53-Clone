// The record form's dropdowns, with the console's own texts (from its string table)
// and order (screenshot Record_Types). Types and routing policies the clone doesn't
// implement are listed but disabled, so the dropdowns look like the console's.

import type { SelectProps } from "@cloudscape-design/components/select";

import type { RecordType } from "@/lib/api";

type TypeInfo = {
  label: string;
  /** The Value box's placeholder for this type. */
  placeholder: string;
};

export const RECORD_TYPES: Record<RecordType, TypeInfo> = {
  A: { label: "A – Routes traffic to an IPv4 address and some AWS resources", placeholder: "192.0.2.235" },
  AAAA: {
    label: "AAAA – Routes traffic to an IPv6 address and some AWS resources",
    placeholder: "2001:0db8::8a2e:0370:bab5",
  },
  CNAME: {
    label: "CNAME – Routes traffic to another domain name and to some AWS resources",
    placeholder: "www.example.com",
  },
  MX: { label: "MX – Specifies mail servers", placeholder: "10 mailserver.example.com" },
  TXT: {
    label: "TXT – Used to verify email senders and for application-specific values",
    placeholder: "Sample Text Entries",
  },
  PTR: { label: "PTR – Maps an IP address to a domain name", placeholder: "www.example.com" },
  SRV: {
    label: "SRV – Application-specific values that identify servers",
    placeholder: "1 10 5269 xmpp-server.example.com",
  },
  CAA: {
    label: "CAA – Restricts CAs that can create SSL/TLS certificates for the domain",
    placeholder: '0 issue "caa.example.com"',
  },
  NS: { label: "NS – Name servers for a hosted zone", placeholder: "ns1.amazon.com" },
};

// In a private zone the console words NS differently.
const NS_PRIVATE_LABEL = "NS – Nameservers to delegate via the Resolver Outbound Endpoint with delegation rule";

// The console's full list, in its order. Types given as objects aren't implemented
// in the clone and are shown disabled.
const TYPE_ORDER: (RecordType | { value: string; label: string })[] = [
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "TXT",
  "PTR",
  "SRV",
  { value: "SPF", label: "SPF – Not recommended" },
  { value: "NAPTR", label: "NAPTR – Used by DDDS applications" },
  "CAA",
  "NS",
  { value: "DS", label: "DS - Delegation Signer, used to establish a chain of trust for DNSSEC" },
  {
    value: "TLSA",
    label: "TLSA - Associates a TLS server certificate or public key with the domain name. DNSSEC required.",
  },
  { value: "SSHFP", label: "SSHFP - Specifies the SSH key fingerprint and algorithm. DNSSEC required." },
  {
    value: "HTTPS",
    label:
      "HTTPS - Provides connection optimization details like protocols, ports, and endpoints for efficient " +
      "client-service communication.",
  },
  { value: "SVCB", label: "SVCB - Delivers extensible configuration information for accessing service endpoints." },
];

export function recordTypeLabel(type: RecordType, privateZone: boolean): string {
  return type === "NS" && privateZone ? NS_PRIVATE_LABEL : RECORD_TYPES[type].label;
}

/** The Record type dropdown's options. */
export function recordTypeOptions(privateZone: boolean): SelectProps.Option[] {
  return TYPE_ORDER.map((entry) =>
    typeof entry === "string"
      ? { value: entry, label: recordTypeLabel(entry, privateZone) }
      : { ...entry, disabled: true },
  );
}

/** The Routing policy dropdown: only simple routing is implemented. */
export const ROUTING_POLICY_OPTIONS: SelectProps.Option[] = [
  { value: "simple", label: "Simple routing" },
  ...["Weighted", "Geolocation", "Latency", "Failover", "IP-based", "Multivalue answer", "Geoproximity"].map(
    (label) => ({ value: label.toLowerCase(), label, disabled: true }),
  ),
];

/** The TTL presets next to the TTL box: 1m, 1h, 1d. */
export const TTL_PRESETS = [
  { label: "1m", seconds: 60 },
  { label: "1h", seconds: 3600 },
  { label: "1d", seconds: 86400 },
];

export const DEFAULT_TTL = 300;

/**
 * The console's hint when a record name starts or ends with spaces (they'd be trimmed),
 * or undefined when it doesn't.
 */
export function nameSpacesWarning(name: string): string | undefined {
  const front = /^\s/.test(name);
  const back = /\s$/.test(name);
  if (front && back) return "Remove the spaces from the beginning and ending of the name, if they were added in error.";
  if (front) return "Remove the space from the beginning of the name, if it was added in error.";
  if (back) return "Remove the space from the ending of the name, if it was added in error.";
  return undefined;
}

/** The Value box's lines as the API's values: one per non-blank line, trimmed. */
export function valuesFromText(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}
