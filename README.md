# AWS Route 53 Console Clone

A functional clone of the AWS Route 53 web console: hosted zones and DNS records with full CRUD, mocked authentication, and SQLite persistence. It recreates the Route 53 user experience; it does **not** serve real DNS.

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router, TypeScript), AWS Cloudscape Design System, TanStack React Query |
| Backend | FastAPI, SQLAlchemy 2, Alembic migrations, bcrypt |
| Database | SQLite (`backend/route53.db`) |

> **Status:** Phase 3 (hosted zones) complete: list, search, create (public and private), view, edit and delete hosted zones in a Route 53-style console. Phase 4 (DNS records) in progress: the records API is done (create, edit and delete records, with Route 53's validation rules); its console pages come next. Feature progress is tracked in [docs/PLAN.md](docs/PLAN.md).

---

## Setup

### Prerequisites
- **Node.js 20+** and npm
- **Python 3.10+**
- **[uv](https://docs.astral.sh/uv/getting-started/installation/)**, the Python package and project manager (`curl -LsSf https://astral.sh/uv/install.sh | sh`)

### 1. Backend (http://localhost:8000)
```bash
cd backend
uv sync                      # create .venv and install locked dependencies
uv run alembic upgrade head  # create/upgrade backend/route53.db and seed the demo user
uv run uvicorn main:app --reload --port 8000
```
Interactive API docs: http://localhost:8000/docs

### 2. Frontend (http://localhost:3000)
In a second terminal:
```bash
cd frontend
npm install
npm run dev
```

### 3. Sign in
Open http://localhost:3000. You are redirected to the sign-in page. Use the demo account:

| Username | Password |
|---|---|
| `admin` | `password123` |

The account is created by database migration `0002`, so it exists as soon as `alembic upgrade head` has run. Sign out from the **admin ▾** menu in the top-right corner.

### Running tests
```bash
cd backend && uv run pytest
cd frontend && npm run lint && npm run build
```

### Configuration
Defaults work out of the box; override them with env files if needed.

| Variable | File | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | `backend/.env` | `sqlite:///<abs path>/backend/route53.db` | SQLAlchemy URL used by the API **and** Alembic |
| `CORS_ORIGINS` | `backend/.env` | `http://localhost:3000` | Comma-separated origins allowed to call the API directly |
| `SESSION_TTL_HOURS` | `backend/.env` | `12` | Lifetime of a login session (fixed, not extended by activity) |
| `COOKIE_SECURE` | `backend/.env` | `false` | Set `true` when served over HTTPS, so the session cookie is only sent on secure connections |
| `BACKEND_URL` | `frontend/.env.local` | `http://localhost:8000` | Where the Next.js server proxies `/api/*`. **Set before `npm run build`**: rewrites are fixed at build time |

See `backend/.env.example` and `frontend/.env.example`.

---

## What works today

- **Console layout:** top navigation, Route 53's full side navigation (pages that aren't built yet show "Coming soon"), breadcrumbs, a resizable split panel, and stacked notifications. It also works at phone width.
- **Hosted zones list:**
  - Select a zone, then use View details / Edit / Delete.
  - Search with Route 53's property filter (e.g. `Type : Private`), sortable and resizable columns, pagination, and a Preferences dialog (page size, wrap lines, visible columns, search mode).
  - The split panel shows the selected zone's details, including its name servers.
- **Create hosted zone:**
  - Public or private. A private zone is associated with one or more VPCs from a mocked catalog of 35 Regions.
  - Field errors show the console's own wording.
  - Every zone gets its NS and SOA records, with name servers numbered the way Route 53 numbers them.
- **Zone details:**
  - Public and private variants.
  - Records table with its search box and Type / Routing policy / Alias filters.
  - The Accelerated recovery, DNSSEC signing and Tags tabs show their empty states.
- **Edit:** the description, and for private zones the associated VPCs.
- **Delete:** a confirmation dialog where you type `delete`. As in Route 53, a zone that still has records other than NS and SOA can't be deleted. The dialog warns about this, and the API refuses with Route 53's message.

---

## Architecture overview

```
Browser ──► Next.js (:3000) ──/api/* rewrite──► FastAPI (:8000) ──SQLAlchemy──► SQLite
            proxy.ts + pages + Cloudscape UI    routers → DB session           route53.db
```

- The browser only talks to the Next.js origin. `next.config.ts` rewrites `/api/*` to FastAPI, so the session cookie is **same-origin**, with no third-party cookie or CORS-credential issues.
- FastAPI still has an explicit CORS allowlist for any direct cross-origin callers.
- Database access is synchronous SQLAlchemy. Endpoints that touch the DB are plain `def` so FastAPI runs them in its threadpool rather than blocking the event loop.
- The schema is versioned with Alembic. `alembic/env.py` reuses the app's own engine, so migrations and the API can never point at different databases.

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · decisions and trade-offs: [docs/DECISIONS.md](docs/DECISIONS.md)

### Authentication
Mocked, but built the way a real session system works:

- **Server-side sessions.** `POST /api/auth/login` checks the password against a **bcrypt** hash, stores a new session in the `sessions` table and returns its token in an **httpOnly, SameSite=Lax cookie**. JavaScript never sees the token, so XSS can't steal it. Only the token's SHA-256 hash is stored, so a copy of the database contains no usable sessions.
- **Expiry and logout are enforced by the server.** Every protected request looks the session up and checks `expires_at` (12 h, fixed). Sign out deletes the row, so a copied cookie stops working immediately.
- **Session restore.** On every page load the frontend calls `GET /api/auth/me`. A valid cookie means you stay signed in after a refresh.
- **Two-layer route protection in the frontend.** `src/proxy.ts` redirects to `/login` on the server when there is no session cookie at all, so no protected page flashes. `<AuthGuard>` then confirms the session with `/me`, which catches expired or forged cookies. The backend's `401` remains the real security boundary.
- **Redirects.** If a session expires, you return to the same page after signing in again (`/login?next=…`). An explicit **Sign out** always lands on a plain `/login`, so the next person to sign in doesn't inherit the previous user's page.

### Why the sign-in page isn't a copy of the AWS sign-in page
Everything after sign-in follows the Route 53 console as closely as possible. The sign-in page deliberately does not imitate `signin.aws.amazon.com`, and there is no sign-up page:

- **It isn't part of Route 53.** AWS sign-in and sign-up belong to AWS accounts and IAM, which this project mocks. The Route 53 console experience starts after you're signed in.
- **Copying a real credential page is a phishing pattern.** A pixel-perfect imitation of the AWS sign-in page, hosted somewhere other than AWS, is exactly what credential-phishing kits look like. A demo shouldn't teach people to type real AWS credentials into a page that isn't AWS's, so the page is clearly branded "Route 53 Clone" and shows the demo credentials.
- **The real flow's fields would be fake.** AWS sign-in asks for root user vs IAM user, a 12-digit account ID or alias, and MFA. Sign-up asks for email verification, contact details and payment card verification. Without real accounts behind them these would be decoration with no behaviour.
- **One seeded demo user is enough.** Registration and password management don't exist in the Route 53 console either. Removing them keeps the project focused on hosted zones and records.

The page is still built with Cloudscape (form, fields, validation messages, error alert), so it is visually consistent with the console that follows.

### Repository layout
```
backend/
  main.py            FastAPI app, CORS, global 400 validation handler, router registration
  config.py          typed settings (pydantic-settings)
  database.py        engine, session factory, Base (with constraint naming convention), get_db
  models.py          ORM models: User, UserSession, HostedZone, HostedZoneVpc, DnsRecord
  schemas.py         Pydantic request/response models
  security.py        bcrypt password hashing, session token generation + hashing
  dependencies.py    get_current_user: the session check every protected endpoint uses
  services/          business rules (zones.py: zone IDs, name servers, default records, CRUD;
                     records.py: Route 53's record rules, atomic batch create/delete)
  record_values.py   per-type validation and normalization of record values
  dns_names.py       zone and record name validation and normalization
  mock_vpcs.py       mocked Regions and VPCs for private zones
  routers/           one module per resource (health, auth, zones, records, vpcs)
  alembic/           migration environment + versions/
  tests/             pytest suite (isolated temp DB per test)
frontend/
  next.config.ts     /api proxy rewrite
  src/proxy.ts       server-side redirect to /login when there is no session cookie
  src/app/           App Router: root layout + providers, login/, (console)/ protected route group
                     with hosted-zones/ (list, create, [zoneId] details, [zoneId]/edit)
  src/components/    Cloudscape-based components (ConsoleShell, RecordsTable, DeleteZoneModal, ...)
  src/lib/           api.ts (typed fetch wrapper), auth.ts, zones.ts (data hooks), navigation.ts,
                     notifications.tsx, console-page.tsx
docs/                plan, architecture, schema, API, decisions
```

---

## Database schema

SQLite, managed by Alembic (`backend/alembic/versions/`). Current revision: **0004**.

| Table | Purpose | Key columns |
|---|---|---|
| `users` | Login accounts | `id` PK, `username` UNIQUE, `password_hash` (bcrypt), `created_at` |
| `sessions` | Active logins | `token_hash` PK (SHA-256 of the cookie token), `user_id` FK → `users.id` `ON DELETE CASCADE`, `created_at`, `expires_at` (indexed) |
| `hosted_zones` | Hosted zones | `id` PK (Route 53-style, e.g. `Z02020872110QTE2FC2NK`), `user_id` FK `ON DELETE CASCADE`, `name` (`example.com.`), `type` (`public`/`private`), `description`, timestamps. `UNIQUE(user_id, name)` |
| `hosted_zone_vpcs` | VPCs of a private zone | `id` PK, `zone_id` FK `ON DELETE CASCADE`, `region`, `vpc_id`. `UNIQUE(zone_id, vpc_id)` |
| `records` | DNS records | `id` PK, `zone_id` FK `ON DELETE CASCADE`, `name`, `type`, `ttl`, `rdata` (JSON list of values), timestamps; `UNIQUE(zone_id, name, type)` |

A zone's record count isn't stored; it's counted in the same query that lists the zones. Full design and reasoning: [docs/DB_SCHEMA.md](docs/DB_SCHEMA.md).

---

## API overview

All endpoints live under `/api`. Errors use the shape `{"detail": "..."}`. Validation errors are `400` (not FastAPI's default `422`).

| Method | Path | Status | Description |
|---|---|---|---|
| GET | `/api/health` | ✅ | API + database liveness. `200 {"status":"ok","database":"ok","version":"0.1.0"}` or `503` with `"database":"error"` |
| POST | `/api/auth/login` | ✅ | `{username, password}` → `200 {id, username}` + httpOnly `session` cookie; `401` on bad credentials |
| POST | `/api/auth/logout` | ✅ | Deletes the session and clears the cookie. `204`, idempotent |
| GET | `/api/auth/me` | ✅ | Current user `200 {id, username}`, or `401` |
| GET | `/api/zones` | ✅ | The user's zones, each with its record count |
| POST | `/api/zones` | ✅ | Create a public or private zone → `201` with its NS and SOA records; `400` invalid name or VPC; `409` duplicate name |
| GET | `/api/zones/{id}` | ✅ | One zone with its name servers and records; `404` if missing or another user's |
| PATCH | `/api/zones/{id}` | ✅ | Change the description and (private zones) the VPCs |
| DELETE | `/api/zones/{id}` | ✅ | `204`; `409` while the zone has records other than NS and SOA |
| GET | `/api/vpcs` | ✅ | The mocked Regions and VPCs offered for private zones |
| GET | `/api/zones/{id}/records` | ✅ | The zone's records |
| POST | `/api/zones/{id}/records` | ✅ | Create one or more records, all or none → `201`; `400` invalid value/name; `409` duplicate name + type or CNAME conflict |
| PATCH | `/api/zones/{id}/records/{rid}` | ✅ | Change a record's TTL and/or values (name and type are fixed) |
| DELETE | `/api/zones/{id}/records/{rid}` | ✅ | `204`; `400` for the SOA record and the apex NS record |
| POST | `/api/zones/{id}/records/batch-delete` | ✅ | Delete several records, all or none → `204` |

Full reference: [docs/API.md](docs/API.md) · live OpenAPI docs at `/docs` on the backend.
