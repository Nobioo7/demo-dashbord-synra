# System Analysis — Phase 9 Production Readiness

Audit update: 2026-10-25

## Executive Summary

The application now uses Supabase-backed workspaces and memories, signed NextAuth identity for dashboard-to-backend requests, workspace ownership checks, and randomly generated per-workspace integration keys stored as hashes. Dashboard build and backend tests pass; lint exits successfully with one existing unused-variable warning. This validates the code and fake-Supabase behavior, not a live Supabase project or deployed services. Production deployment is **not yet verified**: no production credentials were supplied, and the referenced `agentmemory-service` template is absent from this checkout.

## Critical Issues / Deployment Blockers

1. **Production Supabase and OAuth are not configured or live-tested.**
   `backend/database.py:9-16` returns no database client when Supabase credentials are absent; protected storage operations and `/health` then return `503`. Render/Vercel credentials and an OAuth callback have not been supplied or tested. No external service was contacted during this work.
2. **The AgentMemory Render template is missing.**
   `DEPLOYMENT.md:61-70` records that this checkout has no `agentmemory-service/` directory and upstream first-run setup is interactive. A production engine deployment, persistent storage, port binding, health check, and bearer-token handshake remain to be validated.
3. **Legacy memory data has no verified tenant owner.**
   The older `memory_events` table is unscoped and unused by the current API. `DEPLOYMENT.md:17-20` documents why its rows are not copied into customer workspaces automatically. Any migration requires an explicit ownership mapping.

## Major Findings and Changes

- **Dashboard identity is no longer a global API key.** The Next.js proxy validates NextAuth, removes caller-supplied key/identity headers, and signs the stable subject with `SYNRA_SESSION_SECRET` (`dashboard/src/app/backend/[...path]/route.ts:12-52`). FastAPI verifies that HMAC and its 60-second timestamp (`backend/main.py:113-135`).
- **Workspace ownership is enforced server-side.** Web requests resolve a workspace by both its UUID and the signed owner ID; integration keys are restricted to their bound workspace (`backend/main.py:498-539`). Memory listing, detail, and soft-delete queries include the resolved `workspace_id` (`backend/main.py:1529-1645`).
- **Integration keys are scoped and revocable.** The backend generates high-entropy keys, stores only SHA-256 hashes, updates last-use timestamps, and only returns the raw key when created (`backend/main.py:138-158`, `backend/main.py:1150-1212`). Dashboard Connections provides create/list/revoke and one-time copy UI (`dashboard/src/components/app/ConnectionsPanel.tsx:91-205`, `dashboard/src/components/app/ConnectionsPanel.tsx:258-315`).
- **Workspace creation is persisted.** Onboarding posts to the authenticated workspace endpoint and stores the returned ID separately from the display name; the backend verifies ownership on later requests (`dashboard/src/app/onboarding/page.tsx:17-43`, `dashboard/src/app/(app)/layout.tsx:10-31`).
- **AgentMemory graph data is workspace-filtered.** The route requires the caller's bound workspace or validates web ownership (`backend/agentmemory_bridge.py:25-55`). The transformer includes only records with an exact workspace/project association or linked to an explicitly scoped session (`backend/agentmemory_client.py:70-156`). Unscoped engine records intentionally do not appear.
- **Supabase schema is prepared.** The new migration creates `workspaces`, `memories`, `api_keys`, `sync_runs`, and `waitlist_signups`, enables RLS, and restricts table grants to `service_role` (`supabase/migrations/20261025000000_init.sql:1-75`). Production access still depends on applying this migration and configuring the service-role secret.
- **Production localhost fallbacks are disabled.** The dashboard proxy fails configuration checks when `SYNRA_BACKEND_URL` is absent in production (`dashboard/src/app/backend/[...path]/route.ts:5-17`); AgentMemory likewise does not fall back to localhost in production (`backend/agentmemory_client.py:10-25`). Localhost defaults remain for development examples only.
- **Render/Vercel instructions are documented.** `render.yaml` defines the FastAPI service, production environment, health check, and non-committed secrets. `DEPLOYMENT.md` lists Supabase, Render, AgentMemory, Vercel, MCP, and extension prerequisites.

## Minor Issues / Warnings

- Dashboard lint reports one unused `source` variable in `dashboard/src/components/app/MemoryBrowser.tsx:20` (0 errors). It predates and is unrelated to this Phase 9 work; left unchanged.
- Backend tests emit a Starlette `DeprecationWarning` because the installed Starlette test client still uses `httpx`; all tests nevertheless pass.
- The backend tests use a fake Supabase query client. They do not verify real PostgREST behavior, SQL migration application, service-role permissions, RLS behavior, or production network configuration.
- Browser-based visual verification and end-to-end sign-in against Google, Supabase, Render, and AgentMemory remain outstanding.

## Test Results

### Dashboard build

```text
$ next build
▲ Next.js 16.3.4 (Turbopack)
✓ Running next.config.ts took 339ms

  Creating an optimized production build ...
✓ Compiled successfully in 7.0s
  Running TypeScript ...
  Finished TypeScript in 13.8s ...
  Collecting page data using 7 workers ...
  Generating static pages using 7 workers (0/15) ...
  Generating static pages using 7 workers (3/15)
  Generating static pages using 7 workers (7/15)
  Generating static pages using 7 workers (11/15)
✓ Generating static pages using 7 workers (15/15) in 2.3s
  Finalizing page optimization ...
Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/auth/[...nextauth]
├ ƒ /app
├ ƒ /app/connections
├ ƒ /app/graph
├ ƒ /app/ingest
├ ƒ /app/memories
├ ƒ /app/memories/[id]
├ ƒ /app/overview
├ ƒ /app/settings
├ ƒ /backend/[...path]
├ ƒ /login
├ ƒ /onboarding
├ ƒ /signup
└ ○ /workspace
ƒ Proxy (Middleware)
○ (Static) prerendered as static content
ƒ (Dynamic) server-rendered on demand
BUILD_EXIT=0
```

### Dashboard lint

```text
$ eslint
dashboard/src/components/app/MemoryBrowser.tsx
  20:24  warning  'source' is defined but never used  @typescript-eslint/no-unused-vars
✖ 1 problem (0 errors, 1 warning)
LINT_EXIT=0
```

### Backend tests

```text
Ran 38 tests in 0.670s
OK
TEST_EXIT=0
```

## Deployment Readiness

**Code prepared; production deployment is not yet verified or approved.** Apply the Supabase migration, configure secrets and Google OAuth, deploy the Render API, provide a verified AgentMemory service deployment, and run live `/health`, authentication, workspace-isolation, memory CRUD, and graph checks before production traffic.
