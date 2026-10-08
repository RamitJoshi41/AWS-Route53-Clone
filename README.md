# AWS Route 53 Console Clone

A functional clone of the AWS Route 53 web console: hosted zones and DNS records with full CRUD, mocked authentication, and SQLite persistence. It recreates the Route 53 user experience; it does **not** serve real DNS.

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router, TypeScript), AWS Cloudscape Design System |
| Backend | FastAPI, SQLAlchemy 2, Alembic migrations |
| Database | SQLite (`backend/route53.db`) |

> **Status:** Phase 1 (project setup) complete: both apps run, the frontend reaches the backend health check, and the database is created by migrations. Feature progress is tracked in [docs/PLAN.md](docs/PLAN.md).

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
uv run alembic upgrade head  # create/upgrade backend/route53.db
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
Open http://localhost:3000. The **Backend status** card should show *Connected* and *Available*.

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
| `BACKEND_URL` | `frontend/.env.local` | `http://localhost:8000` | Where the Next.js server proxies `/api/*`. **Set before `npm run build`**: rewrites are fixed at build time |

See `backend/.env.example` and `frontend/.env.example`.

---

## Architecture overview

```
Browser ──► Next.js (:3000) ──/api/* rewrite──► FastAPI (:8000) ──SQLAlchemy──► SQLite
            pages + Cloudscape UI               routers → DB session           route53.db
```

- The browser only talks to the Next.js origin. `next.config.ts` rewrites `/api/*` to FastAPI, so the session cookie (coming in Phase 2) is **same-origin**, with no third-party cookie or CORS-credential issues.
- FastAPI still has an explicit CORS allowlist for any direct cross-origin callers.
- Database access is synchronous SQLAlchemy. Endpoints that touch the DB are plain `def` so FastAPI runs them in its threadpool rather than blocking the event loop.
- The schema is versioned with Alembic. `alembic/env.py` reuses the app's own engine, so migrations and the API can never point at different databases.

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · decisions and trade-offs: [docs/DECISIONS.md](docs/DECISIONS.md)

### Repository layout
```
backend/
  main.py            FastAPI app, CORS, router registration
  config.py          typed settings (pydantic-settings)
  database.py        engine, session factory, Base, get_db dependency
  routers/           one module per resource (health.py so far)
  alembic/           migration environment + versions/
  tests/             pytest suite (isolated temp DB per test)
frontend/
  next.config.ts     /api proxy rewrite
  src/app/           App Router pages and root layout
  src/components/    React components (Cloudscape-based)
  src/lib/api.ts     typed fetch wrapper for the backend
docs/                plan, architecture, schema, API, decisions
```

---

## Database schema

SQLite, managed by Alembic (`backend/alembic/versions/`). Current revision **0001 (baseline)** creates the database file only; tables are added phase by phase.

Planned tables: `users`, `sessions`, `hosted_zones` (Route 53-style string IDs such as `Z148QEXAMPLE8V`), `records` (FK to zone with `ON DELETE CASCADE`). Full design: [docs/DB_SCHEMA.md](docs/DB_SCHEMA.md).

---

## API overview

All endpoints live under `/api`. Errors use the shape `{"detail": "..."}`.

| Method | Path | Status | Description |
|---|---|---|---|
| GET | `/api/health` | ✅ | API + database liveness. `200 {"status":"ok","database":"ok","version":"0.1.0"}` or `503` with `"database":"error"` |
| POST | `/api/auth/login`, `/logout`; GET `/api/auth/me` | Phase 2 | Mocked session auth (httpOnly cookie) |
| GET/POST/PATCH/DELETE | `/api/zones[/{id}]` | Phase 3 | Hosted zones CRUD |
| GET/POST/PATCH/DELETE | `/api/zones/{id}/records[/{rid}]` | Phase 4 | DNS records CRUD |

Full reference: [docs/API.md](docs/API.md) · live OpenAPI docs at `/docs` on the backend.
