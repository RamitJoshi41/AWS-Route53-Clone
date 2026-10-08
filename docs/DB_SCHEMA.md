# Database Schema (SQLite)

This document outlines the SQLite database schema for the AWS Route53 Clone.

## Migrations & connection settings

*   The schema is managed with **Alembic** (`backend/alembic/versions/`). Create or upgrade the DB with `cd backend && uv run alembic upgrade head`.
*   **Current revision: `0002`.**

    | Revision | Contents |
    |---|---|
    | `0001` | Baseline. Empty; creates `route53.db` (plus Alembic's `alembic_version` table). |
    | `0002` | `users` and `sessions` tables, plus the seeded demo user `admin` / `password123`. |

*   `PRAGMA foreign_keys=ON` is set on every SQLite connection, so `FOREIGN KEY` constraints and `ON DELETE CASCADE` are actually enforced.
*   Migrations run in batch mode (`render_as_batch=True`), which SQLite needs for column changes.
*   **Constraint naming convention** (`Base.metadata` in `database.py`): every constraint and index gets a predictable name (`pk_users`, `uq_users_username`, `fk_sessions_user_id_users`, `ix_sessions_expires_at`). SQLite batch migrations can only drop or alter a constraint later if it has a name.
*   **Timestamps** are stored as naive UTC (`models.utcnow()`); SQLite has no timezone-aware type.
*   **Seed data lives in a migration**, and calls `bcrypt` directly rather than importing app code, so the migration keeps producing the same result if the app's code changes later.

> **Status:** `users` and `sessions` are implemented. The `hosted_zones` and `records` designs are drafts. Field names (e.g. `comment` vs `description`, `is_private` vs `type`) and the record value storage are finalized at the start of Phase 3/4. The **hosted zone ID format** and **zone ownership** are already decided (see below).

## Tables

### `users` ✅ (revision 0002)
Login accounts. One demo account (`admin`) is seeded by the migration.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK | Auto-increment |
| `username` | VARCHAR(150) | NOT NULL, UNIQUE (`uq_users_username`) | Exact-match login name |
| `password_hash` | VARCHAR(255) | NOT NULL | bcrypt hash such as `$2b$12$…` (60 chars). Salted, deliberately slow. Plaintext is never stored. |
| `created_at` | DATETIME | NOT NULL | UTC |

### `sessions` ✅ (revision 0002)
One row per active login. Deleting the row is what ends a session (sign out, expiry).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `token_hash` | VARCHAR(64) | PK | SHA-256 hex of the cookie token |
| `user_id` | INTEGER | NOT NULL, FK → `users.id` `ON DELETE CASCADE`, indexed | Deleting a user removes their sessions |
| `created_at` | DATETIME | NOT NULL | UTC |
| `expires_at` | DATETIME | NOT NULL, indexed | `created_at + SESSION_TTL_HOURS` (12 h). Checked on every request. |

**Why store a hash of the token, not the token?** The cookie holds a 256-bit random token. If the database file leaked, raw tokens would let anyone impersonate every signed-in user. With only `sha256(token)` stored, the leak yields nothing usable. Each request hashes the cookie and looks up the primary key, so it costs the same. A fast hash is fine here (unlike for passwords): the token is random, so there is nothing to brute-force.

**Why server-side sessions rather than a JWT?** Sign out and expiry take effect immediately because the server deletes or checks the row. A stateless JWT can't be revoked before it expires without adding a denylist table, which is a sessions table again.

**Cleanup:** an expired row is deleted when a request presents it, and every successful login deletes all expired rows (indexed `expires_at`). Logging in again also deletes the browser's previous session.

### `hosted_zones`
Stores information about DNS Hosted Zones.
*   `id` (VARCHAR, Primary Key): Route53-style ID (e.g., `Z148QEXAMPLE8V`). **Decided:** short, uppercase alphanumeric, `Z`-prefixed string generated server-side, not an auto-increment integer, to match how the real console shows zone IDs in tables and URLs. The exact generator is implemented in Phase 3.
*   `user_id` (INTEGER, Foreign Key to `users.id`, Not Null). **Decided:** every zone belongs to the user who created it, and all zone and record queries are filtered by the signed-in user. Another user's zone is reported as `404`, as if it didn't exist.
*   `name` (VARCHAR, Not Null): Domain name (e.g., `example.com.`).
*   `caller_reference` (VARCHAR, Unique, Not Null): Prevents duplicate zone creation requests.
*   `comment` (TEXT, Nullable): Optional description.
*   `is_private` (BOOLEAN, Default False): Public vs Private hosted zone.
*   `vpc_id` (VARCHAR, Nullable): Associated VPC (mocked) if `is_private` is true.
*   `record_count` (INTEGER, Default 0): Denormalized count of records for faster table rendering.
*   `created_at` (DATETIME, Default CURRENT_TIMESTAMP).

*Indexes:*
*   `idx_hosted_zones_name` on `name` for faster searching.

### `records`
Stores DNS records within a hosted zone.
*   `id` (VARCHAR, Primary Key): Unique identifier (UUID).
*   `zone_id` (VARCHAR, Foreign Key to `hosted_zones.id`, Not Null, On Delete Cascade).
*   `name` (VARCHAR, Not Null): Record name (e.g., `www.example.com.`).
*   `type` (VARCHAR, Not Null): Record type (A, AAAA, CNAME, TXT, MX, NS, PTR, SRV, CAA).
*   `ttl` (INTEGER, Default 300): Time to Live in seconds.
*   `routing_policy` (VARCHAR, Default 'Simple'): Mocked routing policy (Simple, Weighted, etc.).
*   `values` (JSON, Not Null): JSON array of strings storing the values for the record.

**Why `values` is JSON:**
Different DNS record types require different numbers and formats of values. An `A` record might have one IP (`["192.0.2.1"]`) or multiple (`["192.0.2.1", "192.0.2.2"]`). An `MX` record has a priority and a value (`["10 mail.example.com"]`). Using a JSON column allows flexible storage of these list-based values without creating a complex child table (`record_values`) or sparsely populated columns for every possible record type attribute, simplifying CRUD operations.

*Constraints & Indexes:*
*   `UNIQUE(zone_id, name, type)`: Generally, you can't have duplicate name+type combinations in the same zone (barring specific routing policies, but we will enforce this for simplicity).
*   `idx_records_zone_id` on `zone_id` for fast retrieval of records for a zone.
