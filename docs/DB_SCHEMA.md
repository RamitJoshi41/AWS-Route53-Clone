# Database Schema (SQLite)

This document outlines the SQLite database schema for the AWS Route53 Clone.

## Migrations & connection settings

*   The schema is managed with **Alembic** (`backend/alembic/versions/`). Create or upgrade the DB with `cd backend && uv run alembic upgrade head`.
*   **Current revision: `0004`.**

    | Revision | Contents |
    |---|---|
    | `0001` | Baseline. Empty; creates `route53.db` (plus Alembic's `alembic_version` table). |
    | `0002` | `users` and `sessions` tables, plus the seeded demo user `admin` / `password123`. |
    | `0003` | `hosted_zones`, `hosted_zone_vpcs` and `records` tables. |
    | `0004` | `UNIQUE(zone_id, name, type)` on `records` (one record set per name and type); drops `ix_records_zone_id`, which the new index covers. |

*   `PRAGMA foreign_keys=ON` is set on every SQLite connection, so `FOREIGN KEY` constraints and `ON DELETE CASCADE` are actually enforced.
*   Migrations run in batch mode (`render_as_batch=True`), which SQLite needs for column changes.
*   **Constraint naming convention** (`Base.metadata` in `database.py`): every constraint and index gets a predictable name (`pk_users`, `uq_users_username`, `fk_sessions_user_id_users`, `ix_sessions_expires_at`). SQLite batch migrations can only drop or alter a constraint later if it has a name.
*   **Timestamps** are stored as naive UTC (`models.utcnow()`); SQLite has no timezone-aware type.
*   **Seed data lives in a migration**, and calls `bcrypt` directly rather than importing app code, so the migration keeps producing the same result if the app's code changes later. For the same reason, migration `0003` contains its own copy of the allowed zone/record types.

## Relationships

```
users 1 ──< sessions
users 1 ──< hosted_zones 1 ──< hosted_zone_vpcs   (private zones only)
                         1 ──< records
```

Every arrow is a foreign key with `ON DELETE CASCADE`: deleting a user removes their sessions and zones, and deleting a zone removes its VPC associations and records. The ORM relationships mirror this with `cascade="all, delete-orphan", passive_deletes=True`, which lets the database do the deleting instead of SQLAlchemy loading every child row first.

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

### `hosted_zones` ✅ (revision 0003)
One row per hosted zone. Each zone belongs to the user who created it.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | VARCHAR(32) | PK | Route 53-style ID, e.g. `Z02020872110QTE2FC2NK` (`Z0` + 19 uppercase letters/digits), generated server-side. Not an auto-increment integer: the console shows this ID in tables and URLs. |
| `user_id` | INTEGER | NOT NULL, FK → `users.id` `ON DELETE CASCADE` | Owner. Every zone query is filtered by the signed-in user; another user's zone is reported as `404`. |
| `name` | VARCHAR(255) | NOT NULL | Normalized domain name: lowercase, one trailing dot (`example.com.`). The UI shows it without the dot, like the console. |
| `type` | VARCHAR(10) | NOT NULL, CHECK `type IN ('public','private')` (`ck_hosted_zones_type`) | Can't change after creation (Route 53 doesn't allow it either). |
| `description` | VARCHAR(256) | nullable | Optional; up to 256 characters, the console's limit. `NULL` when empty, shown as `-`. |
| `created_at` | DATETIME | NOT NULL | UTC |
| `updated_at` | DATETIME | NOT NULL | UTC, refreshed on every update (`onupdate`) |

*Constraints & indexes:*
*   `UNIQUE(user_id, name)` (`uq_hosted_zones_user_id_name`): a user can't own two zones with the same normalized name, so `Example.COM` and `example.com.` collide. Real Route 53 allows duplicate names (the description tells them apart); the clone rejects them with `409` to keep the list unambiguous. Two *different* users can each own `example.com`.
*   That unique index also answers "all zones of user X", because `user_id` is its leftmost column, so `user_id` has no separate index.

**Not stored: `record_count`.** It is computed when zones are read (a `COUNT` over `records` with a join and `GROUP BY`, using the `records` unique index, whose leftmost column is `zone_id`), so it can never drift from the real number of records. A stored counter would need updating on every record insert and delete.

### `hosted_zone_vpcs` ✅ (revision 0003)
The VPCs associated with a **private** hosted zone. The console lets you add several (`Add VPC`), so this is a child table rather than a column on `hosted_zones`. Public zones have no rows here. That rule ("private needs at least one VPC, public needs none") is enforced by the API, since SQLite can't express it as a constraint.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK | Auto-increment |
| `zone_id` | VARCHAR(32) | NOT NULL, FK → `hosted_zones.id` `ON DELETE CASCADE` | |
| `region` | VARCHAR(32) | NOT NULL | AWS region code, e.g. `ap-south-1` |
| `vpc_id` | VARCHAR(32) | NOT NULL | e.g. `vpc-0403c187a75446b11`, picked from a mocked VPC catalog (no real AWS account behind the clone) |

*Constraints:* `UNIQUE(zone_id, vpc_id)` (`uq_hosted_zone_vpcs_zone_id_vpc_id`): the same VPC can't be associated twice with one zone. Its index also serves "VPCs of zone X".

### `records` ✅ (revision 0003)
DNS record sets: one row per name + type, holding one or more values. Every new zone gets two rows straight away, an `NS` record (4 name servers, TTL 172800) and an `SOA` record (TTL 900), as in Route 53. The records API (Phase 4) creates, edits and deletes the rest.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK | Auto-increment. Addresses a record in the API's URLs; Route 53 shows no ID for simple records. |
| `zone_id` | VARCHAR(32) | NOT NULL, FK → `hosted_zones.id` `ON DELETE CASCADE` | Indexed through the unique constraint below |
| `name` | VARCHAR(255) | NOT NULL | Fully qualified and normalized like zone names (lowercase, one trailing dot), e.g. `www.example.com.`; `*.example.com.` for a wildcard |
| `type` | VARCHAR(10) | NOT NULL, CHECK in `A, AAAA, CAA, CNAME, MX, NS, PTR, SOA, SRV, TXT` (`ck_records_type`) | |
| `ttl` | INTEGER | NOT NULL, CHECK `ttl >= 0` (`ck_records_ttl_non_negative`) | Seconds; the API also caps it at 2147483647, Route 53's maximum |
| `rdata` | JSON | NOT NULL | JSON list of value strings (see below). The API exposes it as `values`. |
| `created_at` | DATETIME | NOT NULL | UTC |
| `updated_at` | DATETIME | NOT NULL | UTC, refreshed on every update |

**Why `rdata` is a JSON list.** A record can hold several values (an `A` record with two IPs: `["192.0.2.1", "192.0.2.2"]`; the NS record's four name servers). Each value is stored as one string in the record's standard text form, e.g. `"10 mail.example.com."` for MX. That is the same shape the Route 53 API uses (`ResourceRecords: [{"Value": "..."}]`) and what the console shows in the "Value/Route traffic to" column. A JSON list keeps a record set in one row, which is how the UI reads and edits it. The alternative was a `record_values` child table, which needs a join for every read with no benefit at this scale. Per-type fields (MX priority, SRV weight/port, CAA flag/tag) stay inside the string; `backend/record_values.py` checks and normalizes their format per type before a row is written, so every stored value is valid for its type.

**Why the column is named `rdata`.** It is the DNS term for a record's data (RFC 1035 "RDATA"). `values` is an SQL keyword, so raw SQL would have to quote it every time.

**Zone deletion rule (enforced by the API, Phase 3 Task 3.2).** As in Route 53, a zone can only be deleted when it contains nothing but its apex `NS` and `SOA` records. Otherwise the API answers `409` with Route 53's message. When deletion is allowed, the `ON DELETE CASCADE` above removes those two records.

*Constraints & indexes:*
*   `UNIQUE(zone_id, name, type)` (`uq_records_zone_id_name_type`, revision `0004`): one record set per name and type in a zone, Route 53's rule with simple routing. The API checks first to return Route 53's message as a `409`; the constraint still stops a duplicate when two requests race. Its index also answers "records of zone X" (`zone_id` is the leftmost column), so the separate `ix_records_zone_id` from `0003` was dropped.
*   Not expressible as a constraint, so enforced by the API (`services/records.py`): a `CNAME` can't share its name with any other record or sit at the zone apex, and the `SOA` and apex `NS` records can't be deleted.
*   If weighted or latency routing were added later, several record sets could share a name and type (told apart by a set identifier), and this constraint would gain a `set_identifier` column.
