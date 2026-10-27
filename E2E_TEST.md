# Synra local end-to-end test

## Prerequisites

- Apply `supabase/migrations/20261025000000_init.sql` to the Supabase project.
- Configure `backend/.env` with `SUPABASE_URL`, `SUPABASE_KEY`, and `SYNRA_SESSION_SECRET`.
- Configure `dashboard/.env.local` with `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, the same `SYNRA_SESSION_SECRET`, and `SYNRA_BACKEND_URL=http://127.0.0.1:8000`.
- AgentMemory is optional for the Synra graph and must be running at the configured `AGENTMEMORY_URL` to test its graph data.

## Start the services

From the repository root, start the backend in one PowerShell terminal:

```powershell
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

In another terminal:

```powershell
Set-Location dashboard
pnpm dev
```

Verify `http://127.0.0.1:8000/health` responds successfully before testing the browser flow.

## Browser test

1. Open `http://localhost:3000/login`. In development, sign in with any non-empty email and password; this is a local-only mock, not a production account.
2. Complete onboarding at `/onboarding` and create a disposable workspace. Confirm the app opens at `/app/overview`.
3. Open `/app/ingest`, add a disposable memory, and confirm the ingest succeeds.
4. Open `/app/memories`. Search for a unique phrase in that memory, confirm it appears, then delete that disposable memory and confirm it disappears.
5. Open `/app/connections` and run GitHub Sync. With `GITHUB_SYNC_MODE=auto` and no GitHub credentials configured, the backend uses its mock sync response; with live credentials, verify the returned repository activity instead.
6. Open `/app/graph`. Verify the Synra Core graph loads. Switch the data source to AgentMemory and confirm either workspace-scoped data appears or the UI reports the service is offline.
7. For tenant isolation, use two distinct Google identities in separate browser sessions and verify the first user's workspace and memories cannot be accessed using the second user's session. The development Credentials provider intentionally maps all local users to one mock identity, so it cannot validate tenant isolation.

## Production auth smoke test

On the deployed site, verify Google sign-in uses the registered production callback URL, then repeat workspace creation and tenant-isolation checks. Do not use the development Credentials provider for production testing; it is disabled outside development.
