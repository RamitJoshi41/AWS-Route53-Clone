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

## Phase 2: Authentication (Mocked)
**Goal:** Implement a simple session-based auth flow to secure the application.
*   **Tasks:**
    *   Create backend `users` and `sessions` tables.
    *   Implement `/api/auth/login`, `/logout`, and `/me` endpoints.
    *   Create frontend Login page.
    *   Implement frontend authentication state and protected routes.
*   **Definition of Done:** User can log in with hardcoded/mock credentials, receive a session cookie, view a protected page, and log out.

## Phase 3: Hosted Zones Core (CRUD)
**Goal:** Allow users to manage their Hosted Zones.
*   **Tasks:**
    *   Create backend `hosted_zones` table.
    *   Implement API endpoints for list, create, get, and delete Hosted Zones.
    *   Build frontend "Hosted Zones" list page (table view).
    *   Build frontend "Create Hosted Zone" form/modal.
    *   Build frontend "Hosted Zone Details" view.
*   **Definition of Done:** A user can view a list of zones, create a new public/private zone, click into a zone's details, and delete a zone from the UI.

## Phase 4: DNS Records Core (CRUD)
**Goal:** Allow users to manage DNS records within a specific Hosted Zone.
*   **Tasks:**
    *   Create backend `records` table linked to `hosted_zones`.
    *   Implement API endpoints for list, create, update, and delete Records.
    *   Build frontend "Records" table inside the Hosted Zone Details view.
    *   Build frontend "Create/Edit Record" form supporting different types (A, CNAME, TXT, etc.).
*   **Definition of Done:** A user can navigate to a Hosted Zone, see its records, add a new A record (or other types), edit an existing record, and delete a record.

## Phase 5: Route53 UI/UX Polish
**Goal:** Replicate the specific look and feel of the AWS console.
*   **Tasks:**
    *   Implement the global AWS-style top navigation bar.
    *   Implement the left sidebar navigation structure.
    *   Add pagination, search, and filtering to the Hosted Zones and Records tables.
    *   Polish forms, modals, buttons, and typography to match AWS.
    *   Add success/error notifications (toast messages).
*   **Definition of Done:** The application visually resembles the AWS Route53 console closely, including navigation, table behaviors, and feedback mechanisms.

## Phase 6: Mocked Sections & Placeholders
**Goal:** Complete the navigation experience with placeholder pages.
*   **Tasks:**
    *   Create generic "Coming Soon" page component.
    *   Wire up sidebar links to: Dashboard, Traffic Policies, Health Checks, Resolver, Profiles.
*   **Definition of Done:** Clicking any non-core feature in the sidebar displays the "Coming Soon" page.

## Phase 7: Documentation & Final Review
**Goal:** Prepare deliverables for submission.
*   **Tasks:**
    *   Update `README.md` with setup instructions.
    *   Finalize `ARCHITECTURE.md` and `DB_SCHEMA.md`.
    *   Code cleanup, linting, and basic manual QA testing.
*   **Definition of Done:** The repository is ready to be zipped/cloned by the evaluator, with clear instructions on how to run it.
