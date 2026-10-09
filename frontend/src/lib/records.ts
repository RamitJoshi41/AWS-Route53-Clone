// DNS record data for the UI: React Query mutations over lib/api.ts, plus the
// record rules the console applies before calling the API.

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createRecords,
  deleteRecords,
  updateRecord,
  type CreateRecordInput,
  type DnsRecord,
  type UpdateRecordInput,
} from "@/lib/api";
import { zoneQueryKey, zonesQueryKey } from "@/lib/zones";

/**
 * A zone's records live in its details query (["zones", id]), and the zones list
 * shows each zone's record count, so every record change refreshes both.
 */
function useRefreshZone(zoneId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: zoneQueryKey(zoneId), exact: true }),
      queryClient.invalidateQueries({ queryKey: zonesQueryKey, exact: true }),
    ]);
}

export function useCreateRecords(zoneId: string) {
  const refreshZone = useRefreshZone(zoneId);
  return useMutation({
    mutationFn: (records: CreateRecordInput[]) => createRecords(zoneId, records),
    onSuccess: refreshZone,
  });
}

export function useUpdateRecord(zoneId: string) {
  const refreshZone = useRefreshZone(zoneId);
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number } & UpdateRecordInput) => updateRecord(zoneId, id, input),
    onSuccess: refreshZone,
  });
}

export function useDeleteRecords(zoneId: string) {
  const refreshZone = useRefreshZone(zoneId);
  return useMutation({
    mutationFn: (recordIds: number[]) => deleteRecords(zoneId, recordIds),
    onSuccess: refreshZone,
  });
}

/**
 * The records Route 53 keeps for as long as the zone exists: its SOA record and
 * the NS record named like the zone. They can't be deleted, so selecting one
 * disables "Delete record" (screenshot 06).
 */
export function isProtectedRecord(record: DnsRecord, zoneName: string): boolean {
  return record.type === "SOA" || (record.type === "NS" && record.name === zoneName);
}
