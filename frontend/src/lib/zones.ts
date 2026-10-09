// Hosted zone data for the UI: React Query hooks over lib/api.ts, plus the small
// formatting rules the console applies when showing zones.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createZone,
  deleteZone,
  getVpcCatalog,
  getZone,
  listZones,
  updateZone,
  type HostedZone,
  type UpdateZoneInput,
  type ZoneType,
} from "@/lib/api";

// Query keys: ["zones"] is the list, ["zones", id] one zone. Invalidating
// ["zones"] after a change refreshes both, because keys match by prefix.
export const zonesQueryKey = ["zones"] as const;
export const zoneQueryKey = (id: string) => ["zones", id] as const;

/** All hosted zones. `enabled: false` waits (the top-bar search only fetches once used). */
export function useZones({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: zonesQueryKey,
    queryFn: ({ signal }) => listZones(signal),
    enabled,
    // The list shows skeleton rows while fetching; the console doesn't reload it
    // just because the browser tab regained focus (refresh is the button).
    refetchOnWindowFocus: false,
  });
}

/** One zone with its name servers and records. Pass undefined to skip fetching. */
export function useZone(id: string | undefined) {
  return useQuery({
    queryKey: zoneQueryKey(id ?? ""),
    queryFn: ({ signal }) => getZone(id!, signal),
    enabled: id !== undefined,
    refetchOnWindowFocus: false,
  });
}

export function useCreateZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createZone,
    onSuccess: (zone) => {
      // The response is the full zone, so the details page it opens next needs no request.
      queryClient.setQueryData(zoneQueryKey(zone.id), zone);
      queryClient.invalidateQueries({ queryKey: zonesQueryKey, exact: true });
    },
  });
}

export function useUpdateZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdateZoneInput) => updateZone(id, input),
    onSuccess: (zone) => {
      queryClient.setQueryData(zoneQueryKey(zone.id), zone);
      queryClient.invalidateQueries({ queryKey: zonesQueryKey, exact: true });
    },
  });
}

export function useDeleteZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteZone(id),
    onSuccess: (_, id) => {
      // Drop the deleted zone's cached details, unless its page is still on screen
      // (it's about to navigate away; removing them now would make it flash "not found").
      queryClient.removeQueries({ queryKey: zoneQueryKey(id), exact: true, type: "inactive" });
      queryClient.invalidateQueries({ queryKey: zonesQueryKey, exact: true });
    },
  });
}

/** The mocked regions and VPCs for private zones. Static data: fetched once per session. */
export function useVpcCatalog() {
  return useQuery({
    queryKey: ["vpcs"],
    queryFn: ({ signal }) => getVpcCatalog(signal),
    staleTime: Infinity,
  });
}

/**
 * Whether a zone holds records besides the NS and SOA records it was created with.
 * Route 53 allows one NS and one SOA record set at the zone apex, so a zone holds
 * only its defaults exactly when it has two records. Such a zone can't be deleted.
 */
export function hasNonDefaultRecords(zone: HostedZone): boolean {
  return zone.record_count > 2;
}

/** "example.com." -> "example.com": the console shows DNS names without the trailing dot. */
export function displayName(name: string): string {
  return name.endsWith(".") ? name.slice(0, -1) : name;
}

export const ZONE_TYPE_LABELS: Record<ZoneType, string> = { public: "Public", private: "Private" };

/** Details-page wording: "Public hosted zone" / "Private hosted zone". */
export function zoneTypeLong(type: ZoneType): string {
  return `${ZONE_TYPE_LABELS[type]} hosted zone`;
}

/**
 * A zone as a table row: every column's text precomputed, so sorting and the
 * property filter work on what the user actually sees (e.g. "example.com",
 * "Public", "-").
 */
export type ZoneRow = {
  id: string;
  zone: HostedZone;
  name: string;
  type: string;
  createdBy: string;
  recordCount: number;
  description: string;
  /** "Disabled" for public zones; private zones don't have the feature ("-"). */
  acceleratedRecovery: string;
};

export function toZoneRow(zone: HostedZone): ZoneRow {
  return {
    id: zone.id,
    zone,
    name: displayName(zone.name),
    type: ZONE_TYPE_LABELS[zone.type],
    // Always Route 53 here: zones created by other AWS services aren't modelled.
    createdBy: "Route 53",
    recordCount: zone.record_count,
    description: zone.description ?? "-",
    // Accelerated recovery isn't implemented, so it's never enabled.
    acceleratedRecovery: zone.type === "public" ? "Disabled" : "-",
  };
}
