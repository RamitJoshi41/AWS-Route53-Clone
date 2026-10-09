// Thin wrapper around fetch for calls to the FastAPI backend.
// All paths are relative to /api, which next.config.ts proxies to the backend,
// so requests are same-origin and the session cookie is sent automatically.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** The machine-readable `code` a few errors carry next to `detail` (backend/errors.py). */
  get code(): string | undefined {
    const body = this.body;
    return body && typeof body === "object" && "code" in body && typeof body.code === "string"
      ? body.code
      : undefined;
  }
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // e.g. the proxy's plain-text 500 when the backend is down
    return text;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  const body = await parseBody(response);

  if (!response.ok) {
    // Backend errors use the shape {"detail": "..."}.
    const detail =
      body && typeof body === "object" && "detail" in body && typeof body.detail === "string"
        ? body.detail
        : `Request failed with status ${response.status}`;
    throw new ApiError(response.status, detail, body);
  }

  return body as T;
}

// --- Auth (backend/routers/auth.py) ---
// The session token lives in an httpOnly cookie: this code never sees it. The
// browser stores it from login's Set-Cookie and sends it with every /api request.

export type User = {
  id: number;
  username: string;
};

export type LoginCredentials = {
  username: string;
  password: string;
};

export function login(credentials: LoginCredentials): Promise<User> {
  return apiFetch<User>("/auth/login", { method: "POST", body: JSON.stringify(credentials) });
}

/** Always 204, even without a session; the backend deletes the session and clears the cookie. */
export function logout(): Promise<null> {
  return apiFetch<null>("/auth/logout", { method: "POST" });
}

/** The logged-in user; throws ApiError(401) without a valid session. */
export function getCurrentUser(signal?: AbortSignal): Promise<User> {
  return apiFetch<User>("/auth/me", { signal });
}

// --- Hosted zones (backend/routers/zones.py, routers/vpcs.py) ---
// Names come back in DNS form with a trailing dot ("example.com."); the UI shows
// them without it, like the console (see displayName in lib/zones.ts).

export type ZoneType = "public" | "private";

export type Vpc = {
  region: string;
  vpc_id: string;
};

/** A hosted zone as returned by the list endpoint. */
export type HostedZone = {
  id: string;
  name: string;
  type: ZoneType;
  description: string | null;
  record_count: number;
  vpcs: Vpc[];
  created_at: string;
  updated_at: string;
};

export type DnsRecord = {
  id: number;
  name: string;
  type: string;
  ttl: number;
  values: string[];
};

/** A single hosted zone with its name servers and records. */
export type HostedZoneDetail = HostedZone & {
  name_servers: string[];
  records: DnsRecord[];
};

export type CreateZoneInput = {
  name: string;
  type: ZoneType;
  description?: string;
  vpcs?: Vpc[];
};

export type VpcCatalog = {
  regions: { code: string; name: string }[];
  vpcs: Vpc[];
};

export function listZones(signal?: AbortSignal): Promise<HostedZone[]> {
  return apiFetch<HostedZone[]>("/zones", { signal });
}

export function getZone(id: string, signal?: AbortSignal): Promise<HostedZoneDetail> {
  return apiFetch<HostedZoneDetail>(`/zones/${encodeURIComponent(id)}`, { signal });
}

export function createZone(input: CreateZoneInput): Promise<HostedZoneDetail> {
  return apiFetch<HostedZoneDetail>("/zones", { method: "POST", body: JSON.stringify(input) });
}

/** Only the description can change (Route 53 doesn't allow renaming or changing the type). */
/** PATCH body: `vpcs` (private zones only) replaces the zone's VPC list; omit it to keep them. */
export type UpdateZoneInput = {
  description: string;
  vpcs?: Vpc[];
};

export function updateZone(id: string, input: UpdateZoneInput): Promise<HostedZoneDetail> {
  return apiFetch<HostedZoneDetail>(`/zones/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** 204 on success; 409 while the zone holds records other than its NS and SOA. */
export function deleteZone(id: string): Promise<null> {
  return apiFetch<null>(`/zones/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function getVpcCatalog(signal?: AbortSignal): Promise<VpcCatalog> {
  return apiFetch<VpcCatalog>("/vpcs", { signal });
}

// --- DNS records (backend/routers/records.py) ---
// Record names are fully qualified ("www.example.com."). Creating and deleting
// several records is all or nothing, as in Route 53.

/** The types a record can be created with (SOA exists only as the zone's own record). */
export type RecordType = "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "PTR" | "SRV" | "CAA" | "NS";

export type CreateRecordInput = {
  name: string;
  type: RecordType;
  ttl: number;
  values: string[];
};

/** PATCH body: any of the edit panel's fields; omitted ones stay as they are. */
export type UpdateRecordInput = Partial<CreateRecordInput>;

/** Route 53's ChangeInfo: every create or edit is a change, PENDING until "propagated", then INSYNC. */
export type ChangeInfo = {
  id: string;
  zone_id: string;
  status: "PENDING" | "INSYNC";
  /** UTC, without an offset. */
  submitted_at: string;
  comment: string | null;
};

const recordsPath = (zoneId: string) => `/zones/${encodeURIComponent(zoneId)}/records`;

export function createRecords(
  zoneId: string,
  records: CreateRecordInput[],
): Promise<{ records: DnsRecord[]; change_info: ChangeInfo }> {
  return apiFetch(recordsPath(zoneId), { method: "POST", body: JSON.stringify({ records }) });
}

export function updateRecord(
  zoneId: string,
  recordId: number,
  input: UpdateRecordInput,
): Promise<{ record: DnsRecord; change_info: ChangeInfo }> {
  return apiFetch(`${recordsPath(zoneId)}/${recordId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** 204; 400 for the SOA record or the apex NS record, in which case nothing is deleted. */
export function deleteRecords(zoneId: string, recordIds: number[]): Promise<null> {
  return apiFetch<null>(`${recordsPath(zoneId)}/batch-delete`, {
    method: "POST",
    body: JSON.stringify({ ids: recordIds }),
  });
}

// --- Changes (backend/routers/changes.py) ---

export function getChange(id: string, signal?: AbortSignal): Promise<ChangeInfo> {
  return apiFetch<ChangeInfo>(`/changes/${encodeURIComponent(id)}`, { signal });
}
