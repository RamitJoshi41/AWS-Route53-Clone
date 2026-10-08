# API Specification

Base URL: `/api` (or relative if proxied).

In development the frontend calls `http://localhost:3000/api/...`, which Next.js proxies to FastAPI on `http://localhost:8000/api/...`. Interactive OpenAPI docs: `http://localhost:8000/docs`.

> Sections below Authentication are the draft design; they are finalized (e.g. `PUT` vs `PATCH`, field names) as each phase is implemented.

## Conventions

### Errors
Every error response has the same shape: a JSON object with a single string `detail`.

| Status | Meaning | Example `detail` |
|---|---|---|
| `400` | Request body/query failed validation, or is not valid JSON | `"password: Field required"` |
| `401` | No session cookie, unknown/logged-out session, expired session, or bad credentials | `"Not authenticated"` |
| `404` | Resource not found | `"Hosted zone not found"` |
| `409` | Conflict with existing data | — |

**Validation errors are `400`, not FastAPI's default `422`.** A global handler (`backend/main.py`) reports the first problem as `"<field>: <message>"`, e.g. `"username: String should have at least 1 character"`. Malformed JSON gives `"body: JSON decode error"`.

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

### `GET /zones`
Lists all hosted zones.
*   **Response (200):**
    ```json
    [
      {
        "id": "Z12345",
        "name": "example.com.",
        "comment": "My test zone",
        "is_private": false,
        "record_count": 2,
        "created_at": "2023-10-27T10:00:00Z"
      }
    ]
    ```

### `GET /zones/{id}`
Gets details for a specific hosted zone.
*   **Response (200):** (Same object as above)
*   **Response (404):** `{"detail": "Hosted zone not found"}`

### `POST /zones`
Creates a new hosted zone.
*   **Request Body:**
    ```json
    {
      "name": "example.com",
      "caller_reference": "unique-string-123",
      "comment": "Optional comment",
      "is_private": false
    }
    ```
*   **Response (201):** Returns created zone object.
*   **Response (400):** `{"detail": "Zone with this caller_reference already exists"}`

### `DELETE /zones/{id}`
Deletes a hosted zone (and cascades to records).
*   **Response (204):** No Content.

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
