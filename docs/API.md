# API Specification

Base URL: `/api` (or relative if proxied).

In development the frontend calls `http://localhost:3000/api/...`, which Next.js proxies to FastAPI on `http://localhost:8000/api/...`. Errors always use the shape `{"detail": "..."}`. Interactive OpenAPI docs: `http://localhost:8000/docs`.

> Sections below Health are the draft design; they are finalized (e.g. `PUT` vs `PATCH`, field names) as each phase is implemented.

## Health

### `GET /health` ✅ implemented
Checks that the API is running and the database answers a `SELECT 1`.
*   **Response (200):** `{"status": "ok", "database": "ok", "version": "0.1.0"}`
*   **Response (503):** `{"status": "error", "database": "error", "version": "0.1.0"}` (API up, database unreachable)
*   **Curl:** `curl http://localhost:8000/api/health`

---

## Authentication

### `POST /auth/login`
Authenticates a user.
*   **Request Body:** `{"username": "user", "password": "password"}`
*   **Response (200):** `{"message": "Logged in successfully"}` (Sets HTTP-only session cookie)
*   **Response (401):** `{"detail": "Invalid credentials"}`
*   **Curl:** `curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"username": "admin", "password": "password"}'`

### `POST /auth/logout`
Logs out the current user.
*   **Response (200):** `{"message": "Logged out"}` (Clears session cookie)

### `GET /auth/me`
Gets the current authenticated user's profile.
*   **Response (200):** `{"id": 1, "username": "admin"}`
*   **Response (401):** `{"detail": "Not authenticated"}`

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
