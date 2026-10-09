# API Specification

Base URL: `/api` (or relative if proxied).

In development the frontend calls `http://localhost:3000/api/...`, which Next.js proxies to FastAPI on `http://localhost:8000/api/...`. Interactive OpenAPI docs: `http://localhost:8000/docs`.

## Conventions

### Errors
Every error response has the same shape: a JSON object with a string `detail`. A few errors also carry a `code`, so the frontend can tell them apart without parsing the message (the console's error banner has its own text for them):

| `code` | When | Banner line in the console |
|---|---|---|
| `RecordSetAlreadyExists` | Creating, renaming or retyping a record onto a name + type that already exists (`409`) | "A record with the specified name already exists." |

All other errors have no `code`; the console shows "Please try again later." for them.

| Status | Meaning | Example `detail` |
|---|---|---|
| `400` | Request body/query failed validation, or is not valid JSON | `"password: Field required"` |
| `401` | No session cookie, unknown/logged-out session, expired session, or bad credentials | `"Not authenticated"` |
| `404` | Resource not found (or owned by another user) | `"No hosted zone found with ID: Z0ABC..."` |
| `409` | Conflict with existing data | `"A hosted zone named example.com already exists."` |

**Validation errors are `400`, not FastAPI's default `422`.** A global handler (`backend/main.py`) reports the first problem as `"<field>: <message>"`, e.g. `"username: String should have at least 1 character"`. Malformed JSON gives `"body: JSON decode error"`. The one exception is a hosted zone's domain name: its rules produce console-style messages that are returned without a field prefix (see `POST /zones`).

### Timestamps
`created_at` / `updated_at` are UTC, serialized without an offset (e.g. `"2026-10-09T05:35:56.635167"`).

### Authentication
Protected endpoints require the `session` cookie set by `POST /auth/login`. Browsers send it automatically (requests are same-origin through the Next.js proxy). With curl, keep it in a cookie jar: `-c jar.txt` to save it, `-b jar.txt` to send it. Any protected endpoint answers `401` without a valid, unexpired session.

| Cookie attribute | Value | Why |
|---|---|---|
| Name | `session` | `SESSION_COOKIE_NAME` |
| Value | 256-bit random token (URL-safe base64) | Only its SHA-256 hash is stored in the `sessions` table |
| `HttpOnly` | yes | JavaScript can't read it, so XSS can't steal it |
| `SameSite` | `Lax` | Not sent on cross-site POSTs (CSRF protection) |
| `Path` | `/` | Sent to every route |
| `Max-Age` | `43200` (12 h) | `SESSION_TTL_HOURS`; expiry is also enforced server-side |
| `Secure` | off by default | `COOKIE_SECURE=true` when served over HTTPS |

## Health

### `GET /health` ✅ implemented
Checks that the API is running and the database answers a `SELECT 1`.
*   **Response (200):** `{"status": "ok", "database": "ok", "version": "0.1.0"}`
*   **Response (503):** `{"status": "error", "database": "error", "version": "0.1.0"}` (API up, database unreachable)
*   **Curl:** `curl http://localhost:8000/api/health`

---

## Authentication

Default account (seeded by migration `0002`): **`admin` / `password123`**.

### `POST /auth/login` ✅ implemented
Verifies the username and password, creates a session, and sets the `session` cookie.
*   **Auth:** none
*   **Request body:**
    ```json
    {"username": "admin", "password": "password123"}
    ```
    `username`: 1–150 characters. `password`: at least 1 character and at most **72 bytes** UTF-8 (bcrypt's limit).
*   **Response (200):** the logged-in user, plus a `Set-Cookie` header:
    ```json
    {"id": 1, "username": "admin"}
    ```
    ```
    set-cookie: session=<token>; HttpOnly; Max-Age=43200; Path=/; SameSite=lax
    ```
*   **Response (401):** `{"detail": "Invalid username or password"}`. This is the same message for an unknown username and a wrong password, so the API doesn't reveal which usernames exist. No cookie is set.
*   **Response (400):** invalid body, e.g. `{"detail": "password: Field required"}`
*   **Side effects:** deletes all expired sessions, and the caller's previous session if it sent one (a fresh token on every login).
*   **Curl:** `curl -i -c jar.txt -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"username": "admin", "password": "password123"}'`

### `POST /auth/logout` ✅ implemented
Ends the session: deletes its row from `sessions` and clears the cookie. Idempotent: it succeeds even without a cookie or with an already-invalid one, so the frontend can always call it.
*   **Auth:** optional
*   **Request body:** none
*   **Response (204):** no body, plus `set-cookie: session=""; Max-Age=0; HttpOnly; Path=/; SameSite=lax`
*   **Curl:** `curl -i -b jar.txt -c jar.txt -X POST http://localhost:8000/api/auth/logout`

### `GET /auth/me` ✅ implemented
Returns the user who owns the current session. The frontend calls it on every page load to restore the login after a refresh.
*   **Auth:** required
*   **Response (200):** `{"id": 1, "username": "admin"}`
*   **Response (401):**
    *   `{"detail": "Not authenticated"}`: no cookie, or the token matches no session (forged or logged out)
    *   `{"detail": "Session expired"}`: the session exists but is past `expires_at`. The row is deleted.
*   **Curl:** `curl -b jar.txt http://localhost:8000/api/auth/me`

---

## Hosted Zones

All endpoints require a session and only ever see the signed-in user's zones. Another user's zone answers `404`, exactly like a zone that doesn't exist.

### The zone object
```json
{
  "id": "Z0GLN2OXWU6NXVLK4MRVZ",
  "name": "demo-site.com.",
  "type": "public",
  "description": "demo",
  "record_count": 2,
  "vpcs": [],
  "created_at": "2026-10-09T05:35:56.635167",
  "updated_at": "2026-10-09T05:35:56.635173"
}
```
| Field | Notes |
|---|---|
| `id` | Route 53-style ID: `Z0` + 19 uppercase letters/digits |
| `name` | Normalized: lowercase, one trailing dot. The UI shows it without the dot. |
| `type` | `"public"` or `"private"`, fixed at creation |
| `description` | Up to 256 characters; `null` when empty |
| `record_count` | Number of records, including the default NS and SOA, counted when read |
| `vpcs` | `[{"region": "ap-south-1", "vpc_id": "vpc-…"}]` for private zones, `[]` for public ones |

**The zone details object** (returned by every endpoint that returns a single zone) adds:
```json
{
  "name_servers": ["ns-1623.awsdns-10.co.uk.", "ns-1452.awsdns-53.org.", "ns-539.awsdns-03.net.", "ns-267.awsdns-33.com."],
  "records": [
    {"id": 1, "name": "demo-site.com.", "type": "NS", "ttl": 172800,
     "values": ["ns-1623.awsdns-10.co.uk.", "ns-1452.awsdns-53.org.", "ns-539.awsdns-03.net.", "ns-267.awsdns-33.com."]},
    {"id": 2, "name": "demo-site.com.", "type": "SOA", "ttl": 900,
     "values": ["ns-1623.awsdns-10.co.uk. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400"]}
  ]
}
```

### `GET /zones` ✅ implemented
Lists the user's hosted zones, sorted by name. Returns zone objects without `name_servers` and `records`.
*   **Response (200):** `[<zone>, ...]` (`[]` when there are none)
*   **Curl:** `curl -b jar.txt http://localhost:8000/api/zones`

### `POST /zones` ✅ implemented
Creates a hosted zone together with its default records, as Route 53 does:
*   an **NS** record (TTL 172800) with 4 name servers. Public zones get one random server per top-level domain (`.com`, `.net`, `.org`, `.co.uk`), numbered the way Route 53 numbers them: `ns-<n>.awsdns-<(n mod 512) div 8>.<tld>.`, where `n` ranges over 0–511 for `.com`, 512–1023 for `.net`, 1024–1535 for `.org` and 1536–2047 for `.co.uk`. Private zones always get `ns-0.awsdns-00.com.`, `ns-512.awsdns-00.net.`, `ns-1024.awsdns-00.org.` and `ns-1536.awsdns-00.co.uk.`.
*   an **SOA** record (TTL 900): `<first name server> awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400`.

*   **Request body:**
    ```json
    {"name": "example.com", "type": "public", "description": "Optional, up to 256 characters"}
    ```
    ```json
    {"name": "internal.example", "type": "private",
     "vpcs": [{"region": "ap-south-1", "vpc_id": "vpc-9deb412321f5fb3d1"}]}
    ```
    `type` defaults to `"public"`. A private zone needs at least one VPC from `GET /vpcs`; a public zone must not list any. Unknown fields are rejected.
*   **Domain name rules:** surrounding spaces, case and one trailing dot are ignored (`Example.COM` = `example.com.`). At least two labels; each label 1–63 characters of `a-z`, `0-9` and `-`, not starting or ending with `-`; at most 253 characters in total; ASCII only (internationalized names in Punycode, `xn--…`).
*   **Response (201):** the zone details object.
*   **Response (400):** a broken rule, for example:
    *   `{"detail": "DomainLabelEmpty (Domain label is empty) encountered with 'a..b'"}` (the console's own wording)
    *   `{"detail": "Domain name is empty."}`
    *   `{"detail": "Domain name 'localhost' must have at least two labels, such as example.com."}`
    *   `{"detail": "vpcs: a private hosted zone must be associated with at least one VPC"}`
    *   `{"detail": "The VPC ID is invalid."}` (the VPC isn't in the catalog for that Region; the console's wording)
    *   `{"detail": "description: String should have at most 256 characters"}`
*   **Response (409):** `{"detail": "A hosted zone named example.com already exists."}`. The user already has a zone with this name, in any spelling. (Real Route 53 allows duplicate names; the clone keeps names unique per user.)
*   **Curl:** `curl -b jar.txt -X POST http://localhost:8000/api/zones -H "Content-Type: application/json" -d '{"name": "example.com", "description": "demo"}'`

### `GET /zones/{id}` ✅ implemented
One zone with its name servers and records (the zone details page).
*   **Response (200):** the zone details object.
*   **Response (404):** `{"detail": "No hosted zone found with ID: Z0ABC..."}` (Route 53's wording)
*   **Curl:** `curl -b jar.txt http://localhost:8000/api/zones/Z0GLN2OXWU6NXVLK4MRVZ`

### `PATCH /zones/{id}` ✅ implemented
Edits a zone: its description, and for a private zone the VPCs it's associated with. Like Route 53, a zone can't be renamed or switched between public and private. Only the fields sent are changed.
*   **Request body:** `{"description": "new text", "vpcs": [{"region": "ap-south-1", "vpc_id": "vpc-…"}]}`. Both fields are optional:
    *   `description`: send `""` or `null` to clear it.
    *   `vpcs`: replaces the zone's whole VPC list (the edit page sends every row). Omit it to keep the current VPCs.
    *   An empty body `{}` changes nothing.
*   **Response (200):** the updated zone details object (`updated_at` moves forward).
*   **Response (400):**
    *   `{"detail": "name: Extra inputs are not permitted"}` (likewise for `type`), or a description over 256 characters.
    *   `vpcs: a public hosted zone can't be associated with VPCs`
    *   `vpcs: a private hosted zone must be associated with at least one VPC` (an empty list)
    *   `vpcs: the same VPC is listed more than once`
    *   `The VPC ID is invalid.` (not in the catalog, or not in that Region)
*   **Response (404):** as for `GET`.
*   **Curl:** `curl -b jar.txt -X PATCH http://localhost:8000/api/zones/Z0GLN2OXWU6NXVLK4MRVZ -H "Content-Type: application/json" -d '{"description": "edited"}'`

### `DELETE /zones/{id}` ✅ implemented
Deletes a zone. As in Route 53, this only works while the zone contains nothing but its default NS and SOA records; those two are removed with it, by the database's `ON DELETE CASCADE`.
*   **Response (204):** no body.
*   **Response (409):** `{"detail": "The specified hosted zone contains non-required resource record sets and so cannot be deleted."}` (Route 53's wording). Delete the other records first.
*   **Response (404):** as for `GET`.
*   **Curl:** `curl -b jar.txt -X DELETE http://localhost:8000/api/zones/Z0GLN2OXWU6NXVLK4MRVZ`

---

## VPCs

### `GET /vpcs` ✅ implemented
The mocked VPC catalog for private zones: the 35 regions offered by the console's Region dropdown (sorted by code), and one default VPC per region. The VPC IDs are derived from the region code, so they're the same on every run.
*   **Auth:** required
*   **Response (200):**
    ```json
    {
      "regions": [{"code": "af-south-1", "name": "Africa (Cape Town)"}, "..."],
      "vpcs": [{"region": "af-south-1", "vpc_id": "vpc-…"}, "..."]
    }
    ```
*   **Curl:** `curl -b jar.txt http://localhost:8000/api/vpcs`

---

## DNS Records

All endpoints require a session. They first look up the zone exactly like `GET /zones/{id}`, so a missing zone or another user's zone answers `404 {"detail": "No hosted zone found with ID: …"}`, and so do the records in it.

### The record object
```json
{"id": 5, "name": "www.example.com.", "type": "A", "ttl": 300, "values": ["192.0.2.1", "192.0.2.2"]}
```
| Field | Notes |
|---|---|
| `id` | Integer, internal. Route 53 shows no ID for simple records; the clone needs one to address a record in URLs. |
| `name` | Fully qualified, normalized: lowercase, one trailing dot. `*.example.com.` is a wildcard record. |
| `type` | `A`, `AAAA`, `CAA`, `CNAME`, `MX`, `NS`, `PTR`, `SRV`, `TXT`, or `SOA` (created with the zone; it can be edited but not created or deleted) |
| `ttl` | Seconds, 0–2147483647 |
| `values` | One string per value, in the type's standard text form: what the console's Value box takes, one per line |

Every record uses the **Simple** routing policy and is not an alias. Other routing policies, alias records and health checks aren't implemented.

### Rules
The same rules Route 53 applies with simple routing:
*   **One record set per name and type** in a zone. A second one is `409`: `Tried to create resource record set [name='www.example.com.', type='A'] but it already exists`. The database enforces this too (`UNIQUE(zone_id, name, type)`).
*   **The name must be in the zone:** `www.example.com` or the apex `example.com` in zone `example.com.`; otherwise `400 RRSet with DNS name www.other.com. is not permitted in zone example.com.` Labels may use `a-z`, `0-9`, `-` and `_` (for `_dmarc`, `_sip._tcp`); `*` only as the whole first label.
*   **CNAME:** not at the zone apex (`400 … is not permitted at apex in zone example.com.`), exactly one value (`400`), and no other record can share its name (`409 … conflicts with other records with the same DNS name …` or `409 … a conflicting RRSet of type CNAME with the same DNS name already exists …`).
*   **The SOA record and the apex NS record can't be deleted, renamed or retyped** (`400 A HostedZone must contain exactly one SOA record.` / `400 A HostedZone must contain at least one NS record for the zone itself.`). Their TTL and values can be edited. NS records for subdomains (delegations) can be created and deleted freely.
*   **Values**, checked per type by `backend/record_values.py`. A broken value is a `400` in Route 53's wording, exactly what the console prints in its error banner: `<problem> encountered with '<value>'`, e.g. `ARRDATAIllegalIPv4Address (Value is not a valid IPv4 address) encountered with 'abc'`:

    | Type | Format (the console's placeholder) | Checks |
    |---|---|---|
    | `A` | `192.0.2.235` | IPv4 address (`ARRDATAIllegalIPv4Address (Value is not a valid IPv4 address)`) |
    | `AAAA` | `2001:0db8::8a2e:0370:bab5` | IPv6 address (`AAAARRDATAIllegalIPv6Address (Value is not a valid IPv6 address)`) |
    | `CNAME`, `PTR`, `NS` | `www.example.com` | Host name |
    | `MX` | `10 mailserver.example.com` | Priority 0–65535, host name |
    | `SRV` | `1 10 5269 xmpp-server.example.com` | Priority, weight and port 0–65535, host name |
    | `TXT` | `"Sample Text Entries"` | One or more quoted strings, each at most 255 bytes. A single word without spaces is accepted and stored quoted (`hello` → `"hello"`); unquoted text with spaces is `InvalidCharacterString (Value should be enclosed in quotation marks)`. |
    | `CAA` | `0 issue "caa.example.com"` | Flag 0–255, tag `issue`/`issuewild`/`issuemail`/`iodef`, one value (quoted on save) |
    | `SOA` | `ns.example.net. hostmaster.example.com. 1 7200 900 1209600 86400` | Two host names and five numbers (edit only) |

    Surrounding spaces are trimmed, extra spaces between fields collapse to one, and leading zeros in numbers are dropped (`010` → `10`). A value listed twice is `400 Duplicate Resource Record: '<value>'` (case-insensitive except inside TXT/CAA text; IPv6 addresses compare by value).

### `GET /zones/{id}/records` ✅ implemented
The zone's records in the console's order: by name in DNS order (labels read from the right, so the apex comes first and each name is followed by its subdomains), then by type, so a zone starts with its NS and SOA records. The same list is also part of `GET /zones/{id}`.
*   **Response (200):** `[<record>, ...]`
*   **Curl:** `curl -b jar.txt http://localhost:8000/api/zones/Z0GLN2OXWU6NXVLK4MRVZ/records`

### `POST /zones/{id}/records` ✅ implemented
Creates one or more records, **all or none**: the console's "Create records" button submits every record on the form together, and Route 53 applies a change batch atomically. Each record is checked against the zone and the records before it in the same request.
*   **Request body** (1–100 records; unknown fields are rejected):
    ```json
    {"records": [
      {"name": "www.example.com", "type": "A", "ttl": 300, "values": ["192.0.2.1", "192.0.2.2"]},
      {"name": "example.com", "type": "MX", "ttl": 300, "values": ["10 mail.example.com"]}
    ]}
    ```
    `name` is fully qualified, as in the Route 53 API (the trailing dot is optional). The console's form adds the zone name to what you type in its "subdomain" box.
*   **Response (201):** the created records, in request order: `[<record>, ...]`
*   **Response (400):** a broken rule or value (see above), the same name and type twice in one request (`The request contains an invalid set of changes for a resource record set 'A www.example.com.'`), `type: SOA`, or request validation such as `records.0.ttl: Input should be greater than or equal to 0`.
*   **Response (409):** the record set already exists, or a CNAME conflict.
*   **Curl:** `curl -b jar.txt -X POST http://localhost:8000/api/zones/Z0GLN2OXWU6NXVLK4MRVZ/records -H "Content-Type: application/json" -d '{"records": [{"name": "www.example.com", "type": "A", "ttl": 300, "values": ["192.0.2.1"]}]}'`

### `PATCH /zones/{id}/records/{record_id}` ✅ implemented
Edits a record: any of the fields of the console's edit panel. Only the fields sent are changed.
*   **Request body:** `{"name": "web.example.com", "type": "A", "ttl": 60, "values": ["192.0.2.1"]}`, every field optional. `values` replaces the whole list.
*   **Renaming or retyping** works like Route 53's delete + create in one change: the new name + type is checked like a new record set against every *other* record (`409` if it exists, CNAME rules), and the values, sent or current, must suit the new type. The SOA and apex NS records keep their name and type (`400`, as for deleting them).
*   **Response (200):** the updated record. Saving without changes also succeeds (the console shows its normal success banner).
*   **Response (400):** a broken value or rule; **(409)** name + type taken, or a CNAME conflict; **(404)** `No record found with ID: 42` (also for a record of another zone).
*   **Curl:** `curl -b jar.txt -X PATCH http://localhost:8000/api/zones/Z0GLN2OXWU6NXVLK4MRVZ/records/5 -H "Content-Type: application/json" -d '{"ttl": 60}'`

### `DELETE /zones/{id}/records/{record_id}` ✅ implemented
Deletes one record.
*   **Response (204):** no body.
*   **Response (400):** the SOA record or the apex NS record; **(404)** unknown record.
*   **Curl:** `curl -b jar.txt -X DELETE http://localhost:8000/api/zones/Z0GLN2OXWU6NXVLK4MRVZ/records/5`

### `POST /zones/{id}/records/batch-delete` ✅ implemented
Deletes several records, **all or none**: the console's "Delete N selected records?" dialog. A `POST` with a body, because a `DELETE` body is ignored by some clients and proxies.
*   **Request body:** `{"ids": [5, 6]}` (1–1000 IDs, no repeats)
*   **Response (204):** no body.
*   **Response (400):** the list includes the SOA record or the apex NS record (nothing is deleted), or an ID is repeated; **(404)** an ID isn't a record of this zone (nothing is deleted).
*   **Curl:** `curl -b jar.txt -X POST http://localhost:8000/api/zones/Z0GLN2OXWU6NXVLK4MRVZ/records/batch-delete -H "Content-Type: application/json" -d '{"ids": [5, 6]}'`
