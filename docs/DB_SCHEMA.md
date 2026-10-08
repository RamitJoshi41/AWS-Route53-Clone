# Database Schema (SQLite)

This document outlines the SQLite database schema for the AWS Route53 Clone.

## Migrations & connection settings

*   The schema is managed with **Alembic** (`backend/alembic/versions/`). Create or upgrade the DB with `cd backend && uv run alembic upgrade head`.
*   **Current revision: `0001` (baseline).** Empty on purpose: it creates `route53.db` (plus Alembic's `alembic_version` table). The tables below are the target design and are added by later revisions, one per phase.
*   `PRAGMA foreign_keys=ON` is set on every SQLite connection, so `FOREIGN KEY` constraints and `ON DELETE CASCADE` are actually enforced.
*   Migrations run in batch mode (`render_as_batch=True`), which SQLite needs for column changes.

> **Status:** the table designs below are a draft. Field names (e.g. `comment` vs `description`, `is_private` vs `type`) and the record value storage are finalized at the start of Phase 3/4. The **hosted zone ID format is already decided** (see below).

## Tables

### `users`
Stores mocked user accounts for authentication.
*   `id` (INTEGER, Primary Key): Unique identifier.
*   `username` (VARCHAR, Unique, Not Null): User's login name.
*   `password_hash` (VARCHAR, Not Null): Hashed password (even for a mock, good practice).
*   `created_at` (DATETIME, Default CURRENT_TIMESTAMP).

### `sessions`
Manages active login sessions.
*   `id` (VARCHAR, Primary Key): Unique session token (UUID).
*   `user_id` (INTEGER, Foreign Key to `users.id`, Not Null).
*   `expires_at` (DATETIME, Not Null): Session expiration time.

### `hosted_zones`
Stores information about DNS Hosted Zones.
*   `id` (VARCHAR, Primary Key): Route53-style ID (e.g., `Z148QEXAMPLE8V`). **Decided:** short, uppercase alphanumeric, `Z`-prefixed string generated server-side, not an auto-increment integer, to match how the real console shows zone IDs in tables and URLs. The exact generator is implemented in Phase 3.
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
