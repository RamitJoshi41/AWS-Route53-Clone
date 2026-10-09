# Project Plan: AWS Route53 Clone

This document breaks down the implementation of the Route53 clone into phased, testable tasks.

## Phase 1: Project Initialization & Setup ✅ (2026-10-09)
**Goal:** Establish the foundational frontend and backend applications.
*   **Tasks:**
    *   Initialize Next.js TypeScript project (`frontend/`).
    *   Initialize FastAPI Python project (`backend/`).
    *   Set up SQLite database connection and migration strategy.
    *   Configure CORS and basic API routing between frontend and backend.
*   **Definition of Done:** Both servers run locally, and the frontend can successfully ping a backend health-check endpoint. Database file is created.

## Phase 2: Authentication (Mocked) ✅ (2026-10-09)
**Goal:** Implement a simple session-based auth flow to secure the application.
*   **Tasks:**
    *   Create backend `users` and `sessions` tables. *(Migration `0002`, which also seeds `admin` / `password123`.)*
    *   Implement `/api/auth/login`, `/logout`, and `/me` endpoints. *(bcrypt, SHA-256-hashed session tokens, httpOnly cookie, 12 h fixed expiry, global 400 validation handler; 21 pytest cases.)*
    *   Create frontend Login page. *(Cloudscape form, `?next=` with open-redirect protection.)*
    *   Implement frontend authentication state and protected routes. *(React Query `["me"]`; `proxy.ts` + `<AuthGuard>`; top navigation with Sign out.)*
*   **Definition of Done:** User can log in with hardcoded/mock credentials, receive a session cookie, refresh and stay logged in, view a protected page (unauthenticated users are redirected to login), and log out (cookie cleared, session invalidated, back on the login page). Unauthenticated API calls return 401.

## Phase 3: Hosted Zones Core (CRUD) ✅ (2026-10-09)
**Goal:** Allow users to manage their Hosted Zones.
*   **Tasks:**
    *   Create backend `hosted_zones` table. *(Migration `0003`: `hosted_zones` with Route 53-style IDs, `hosted_zone_vpcs`, and the `records` table, which every zone needs for its default NS and SOA records.)*
    *   Implement API endpoints for list, create, get, and delete Hosted Zones. *(Plus `PATCH` for the description and a private zone's VPCs, and `GET /api/vpcs` for the mocked VPC catalog. Route 53's name-server numbering, default SOA and delete rule (`409` while other records exist). 104 pytest cases in total.)*
    *   Build frontend "Hosted Zones" list page (table view). *(Selection with header buttons, property filter, sorting, pagination, preferences, split panel with the selected zone's details.)*
    *   Build frontend "Create Hosted Zone" form/modal. *(A full page, as in the console, including private zones with VPC rows.)*
    *   Build frontend "Hosted Zone Details" view. *(Public and private variants, read-only records table with its filters, and the console's other tabs in their empty state.)*
    *   Edit page and delete confirmation dialog (typed `delete`).
    *   The console shell: side navigation, breadcrumbs and stacked notifications.
*   **Definition of Done:** A user can view a list of zones, create a new public/private zone, click into a zone's details, and delete a zone from the UI.

## Phase 4: DNS Records Core (CRUD)
**Goal:** Allow users to manage DNS records within a specific Hosted Zone.
*   **Tasks:**
    *   ~~Create backend `records` table linked to `hosted_zones`.~~ *(Done in Phase 3.)*
    *   Implement API endpoints for list, create, update, and delete Records. ✅ *(Task 4.1: list-taking create and `batch-delete`, both all-or-nothing; per-type value validation in Route 53's error style; CNAME/apex rules; migration `0004` adds `UNIQUE(zone_id, name, type)`.)*
    *   Build frontend "Records" table inside the Hosted Zone Details view. *(Read-only table and filters built in Phase 3.)* ✅ *(Task 4.2: record details in the split panel with copy buttons, Preferences dialog, "Delete record" disabled for the SOA and apex NS records; API corrections from the console references: error wording, `code` for duplicates, editable name/type, DNS order.)*
    *   "View status" for record changes. ✅ *(Task 4.3b: `changes` table (migration `0005`), `GET /api/changes/{id}` with PENDING for 30 s then INSYNC, Change Info page, the blue "submitted" banner with its View status button.)*
    *   Build frontend "Create/Edit Record" form supporting different types (A, CNAME, TXT, etc.). *(Task 4.3 ✅: the Create record page, Quick create with several records per submit, "View existing records". Editing comes in 4.4, deleting in 4.5.)*
*   **Definition of Done:** A user can navigate to a Hosted Zone, see its records, add a new A record (or other types), edit an existing record, and delete a record.

## Phase 5: Route53 UI/UX Polish
**Goal:** Replicate the specific look and feel of the AWS console.
*   **Tasks:**
    *   Implement the global AWS-style top navigation bar.
    *   ~~Implement the left sidebar navigation structure.~~ *(Done in Phase 3.)*
    *   Add pagination, search, and filtering to the Hosted Zones and Records tables. *(Done in Phase 3.)*
    *   Help panel behind the "Info" links.
    *   Polish forms, modals, buttons, and typography to match AWS.
    *   ~~Add success/error notifications (toast messages).~~ *(Done in Phase 3.)*
*   **Definition of Done:** The application visually resembles the AWS Route53 console closely, including navigation, table behaviors, and feedback mechanisms.

## Phase 6: Mocked Sections & Placeholders
**Goal:** Complete the navigation experience with placeholder pages.
*   **Tasks:**
    *   ~~Create generic "Coming Soon" page component.~~ *(Done in Phase 3.)*
    *   ~~Wire up sidebar links to: Dashboard, Traffic Policies, Health Checks, Resolver, Profiles.~~ *(Done in Phase 3: every side-navigation link without a page opens "Coming soon".)*
    *   Dashboard page.
*   **Definition of Done:** Clicking any non-core feature in the sidebar displays the "Coming Soon" page.

## Phase 7: Documentation & Final Review
**Goal:** Prepare deliverables for submission.
*   **Tasks:**
    *   Update `README.md` with setup instructions.
    *   Finalize `ARCHITECTURE.md` and `DB_SCHEMA.md`.
    *   Code cleanup, linting, and basic manual QA testing.
*   **Definition of Done:** The repository is ready to be zipped/cloned by the evaluator, with clear instructions on how to run it.
