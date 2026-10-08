# Decision Log

This log tracks architectural and technical decisions made during the development of the AWS Route53 Clone.

| Date | Decision | Options Considered | Chosen | Reason |
| :--- | :--- | :--- | :--- | :--- |
| 2026-10-08 | Next.js Routing | App Router vs. Pages Router | **App Router** | Modern standard, better performance via server components. |
| 2026-10-08 | UI Component Library | Custom CSS vs. Tailwind vs. AWS Cloudscape | **AWS Cloudscape** | Guarantees a pixel-perfect Route53 look with minimal custom CSS. |
| 2026-10-08 | Backend ORM | SQLAlchemy vs. Raw SQLite | **SQLAlchemy** | Industry standard for FastAPI; safer queries and easier relationships. |
| 2026-10-08 | Client State Management | React Query vs. Context API | **React Query** | Excellent for managing server state, caching, and loading/error states. *(Not installed yet; added when data fetching starts in Phase 2/3.)* |
| 2026-10-08 | Migration strategy | Alembic vs. `Base.metadata.create_all()` vs. manual SQL | **Alembic** | Versioned, reviewable schema history; schema changes don't require deleting the DB. `env.py` reuses the app engine (one source of truth for the URL), with `render_as_batch=True` because SQLite can't `ALTER` most columns in place. |
| 2026-10-08 | Frontend ↔ backend connectivity | Next.js `rewrites` proxy vs. direct cross-origin calls with CORS | **Proxy + CORS allowlist** | Browser only talks to the Next origin, so the httpOnly session cookie is same-origin (no `SameSite=None`/third-party cookie issues when hosted). FastAPI still has `CORSMiddleware` with an explicit origin list from `CORS_ORIGINS` (never `*`, which browsers reject with credentials). |
| 2026-10-08 | Ports | 3000/8000 vs. 3000/8080 | **3000 / 8000** | Framework defaults; overridable via env. |
| 2026-10-08 | Health endpoint | Liveness only vs. liveness + DB check | **`GET /api/health` with `SELECT 1`** | Proves the full browser → proxy → API → DB chain; returns `503` with `"database":"error"` so monitors and the UI can tell "API down" from "DB down". |
| 2026-10-08 | Python tooling | venv + pip + requirements.txt vs. uv + pyproject.toml | **uv + pyproject.toml + uv.lock** | Fast, reproducible installs from a lockfile; `uv sync` is a single setup command. |
| 2026-10-08 | Sync vs. async route handlers | `async def` vs. `def` | **`def` for any DB-touching route** | SQLAlchemy sessions are synchronous; `async def` would block the event loop. FastAPI runs `def` handlers in a threadpool. |
| 2026-10-08 | Hosted zone primary key | Auto-increment integer vs. Route 53-style string ID | **String ID, e.g. `Z148QEXAMPLE8V`** | Matches the real Route 53 console/API (IDs shown in tables and URLs), increasing fidelity. Implemented in Phase 3. |
| 2026-10-09 | Body hydration warning | `suppressHydrationWarning` on `<body>` vs. ignore | **`suppressHydrationWarning` on `<body>` only** | Browser extensions inject attributes (e.g. `class="vc-init"`) before hydration. Suppression applies to `<body>`'s own attributes only; mismatches inside the app are still reported. |
| 2026-10-09 | Next.js Cache Components | Keep `cacheComponents: true` + `<Suspense>` vs. disable vs. patch Cloudscape | **Disabled** | Cloudscape's `Button` calls `Date.now()` during render (internal analytics ID), which makes `next build` fail under Cache Components. Our data is fetched client-side behind auth, so server component caching adds nothing. Trade-off: revisit if upgrading to a Next.js major where the flag becomes mandatory. |
| 2026-10-09 | Test HTTP client | `httpx` vs. `httpx2` | **`httpx2`** | Starlette's `TestClient` deprecates `httpx` in favor of `httpx2`; dev/test-only dependency. |
