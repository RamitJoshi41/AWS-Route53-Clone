# API Specification

Base URL: `/api` (or relative if proxied).

In development the frontend calls `http://localhost:3000/api/...`, which Next.js proxies to FastAPI on `http://localhost:8000/api/...`. Interactive OpenAPI docs: `http://localhost:8000/docs`.

> The **DNS Records** section is still the draft design; it is finalized in Phase 4. Everything above it is implemented.

## Conventions

### Errors
Every error response has the same shape: a JSON object with a single string `detail`.

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

### `GET /zones/{id}/records`
Lists records for a specific hosted zone.
*   **Response (200):**
    ```json
    [
      {
        "id": "uuid-123",
        "zone_id": "Z12345",
        "name": "www.example.com.",
        "type": "A",
        "ttl": 300,
        "routing_policy": "Simple",
        "values": ["192.0.2.1"]
      }
    ]
    ```

### `POST /zones/{id}/records`
Creates a new DNS record.
*   **Request Body:**
    ```json
    {
      "name": "api.example.com",
      "type": "CNAME",
      "ttl": 300,
      "routing_policy": "Simple",
      "values": ["example.com."]
    }
    ```
*   **Response (201):** Returns created record object.

### `PUT /zones/{id}/records/{record_id}`
Updates an existing DNS record.
*   **Request Body:** (Same as POST)
*   **Response (200):** Returns updated record object.

### `DELETE /zones/{id}/records/{record_id}`
Deletes a DNS record.
*   **Response (204):** No Content.
