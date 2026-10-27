# Synra deployment guide

This repository can deploy the Next.js dashboard and FastAPI API as two Vercel
Services from the repository root, or deploy the API separately to Render.
Memory, workspace, integration-key, and sync-run data are stored in Supabase
PostgreSQL. The Supabase service-role key is used only by the backend.

## 1. Create the Supabase schema

1. Create a Supabase project and open its SQL Editor.
2. Run `supabase/migrations/20261025000000_init.sql` once. It creates
   `workspaces`, `memories`, `api_keys`, `sync_runs`, and `waitlist_signups`.
3. In Project Settings → API, copy the project URL and the `service_role` key.
   Store these as `SUPABASE_URL` and `SUPABASE_KEY` in the backend service on
   Vercel or Render only. Do not add either value to the dashboard or commit them.
4. Confirm the tables exist before deploying. The API `/health` endpoint checks
   connectivity to `workspaces` and reports a non-200 response if the database
   is unavailable.

The earlier `memory_events` migration creates a legacy, unscoped table. The
current API does not read it. Do not copy its records into a workspace without
first identifying and verifying each record's owner.

## 2. Deploy FastAPI to Render

1. Import this repository into Render from the repository root.
2. Create a Blueprint deployment from `render.yaml` (or create a Python web
   service with the same build and start commands):
   - Build: `pip install -r backend/requirements.txt`
   - Start: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
   - Health check: `/health`
3. Add the following environment values in Render. Do not commit their values:
   - `SUPABASE_URL`: Supabase project URL.
   - `SUPABASE_KEY`: Supabase `service_role` key.
   - `SYNRA_SESSION_SECRET`: a random secret shared with Vercel.
   - `FRONTEND_URL`: the exact primary dashboard origin, such as
     `https://saynra.in`.
   - `CORS_ALLOWED_ORIGINS`: any additional exact dashboard origins, comma
     separated (for example `https://www.saynra.in`).
   - `AGENTMEMORY_URL`: the deployed AgentMemory service origin, without a path.
   - `AGENTMEMORY_TOKEN`: the AgentMemory service bearer token.
   - `GITHUB_TOKEN`: a read-only token for the repository configured by
     `GITHUB_OWNER` and `GITHUB_REPO`.
4. Keep `APP_ENV=production` and `GITHUB_SYNC_MODE=live` in production. Live mode
   prevents the local mock response from being mistaken for a real GitHub sync.
5. After deployment, verify `https://<render-service>/health` returns HTTP 200
   and `storage.provider` is `supabase`. The `session_signing_configured` value
   must be `true`.

Integration clients use random workspace-scoped API keys created in the
dashboard. The backend stores only a SHA-256 hash. There is no production-wide
`SYNRA_API_KEY`.

## 3. Deploy the AgentMemory engine separately

AgentMemory is a separate service; it is not bundled into the FastAPI Render
service. The upstream project is `rohitg00/agentmemory`. Its documented fresh
install command is `npx -y @agentmemory/agentmemory@latest`; its runtime uses
multiple ports (REST/MCP on 3111, streams on 3112, viewer on 3113, and a worker
WebSocket on 49134) and persistent data storage.

The workspace currently has an `agentmemory-service/` checkout containing
upstream's `deploy/render/render.yaml` template. It is a nested Git repository
and is excluded from the Synra root repository by `.gitignore`; the Render
service must therefore deploy from the AgentMemory repository (or a separately
published fork containing the template), not from the Synra monorepo.

To deploy it, create a Render Blueprint using the AgentMemory repository and
template path `deploy/render/render.yaml`. The blueprint provisions the
persistent `/data` disk and sets `PORT=3111`, `AGENTMEMORY_VERSION`,
`III_VERSION`, and `III_SDK_VERSION`. No LLM provider secret is required for
basic BM25 operation. On first boot, the service generates
`AGENTMEMORY_SECRET` and prints it once in the Render logs. Copy that value to
the backend service's `AGENTMEMORY_TOKEN` variable. The public service URL
becomes `AGENTMEMORY_URL`; the health endpoint is `/agentmemory/livez`.

Once the engine has a stable HTTPS origin and a configured bearer token, set
those values in the FastAPI service as `AGENTMEMORY_URL` and
`AGENTMEMORY_TOKEN`. Verify the upstream `/agentmemory/livez` endpoint before
testing the Synra `/api/v1/agentmemory/graph` endpoint. The graph API returns
only records carrying the requested workspace/project ID; unscoped shared
records are intentionally excluded.

## 4. Deploy the dashboard and API to Vercel Services

1. Import the Git repository into Vercel with the repository root as the project
   root. The root `vercel.json` defines the `backend` FastAPI service and the
   `dashboard` Next.js service; do not set the Vercel project root to
   `dashboard`.
2. Configure Google OAuth with the production callback URL
   `https://<dashboard-domain>/api/auth/callback/google`.
3. Set these environment variables for Production (and Preview if used):
   - `NEXTAUTH_URL`: the canonical dashboard URL.
   - `NEXTAUTH_SECRET`: a fresh random NextAuth secret.
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: Google OAuth credentials.
   - `SYNRA_SESSION_SECRET`: the shared HMAC secret, configured for both
     `dashboard` and `backend`.
   - `SUPABASE_URL` and `SUPABASE_KEY`: backend service only.
   - `APP_ENV=production`: backend service only.
   - `AGENTMEMORY_URL` and `AGENTMEMORY_TOKEN`: backend service only, if the
     AgentMemory graph is enabled.
   - `GITHUB_TOKEN` and any required Gmail credentials: backend service only
     when those integrations are enabled.
4. Do not manually set `SYNRA_BACKEND_URL` in Vercel. The binding in
   `vercel.json` injects the backend service URL into the dashboard at runtime.
   The Connections page derives the public integration URL from the deployed
   origin as `https://<dashboard-domain>/api/v1`; set
   `NEXT_PUBLIC_SYNRA_API_BASE_URL` only when intentionally overriding it.
5. Public routing sends `/api/auth/*` to Next.js, `/api/*` and `/health` to
   FastAPI, and every other path to the dashboard. The backend is reachable
   externally only through those routed paths; its internal service binding
   does not itself make it public. MCP and extension clients use the public
   `https://<dashboard-domain>/api/v1` URL and workspace-scoped API keys.
6. Configure `AGENTMEMORY_URL` and `AGENTMEMORY_TOKEN` with a separately hosted
   AgentMemory service if needed; that engine is not part of this Vercel
   services configuration.
7. Test the services locally with `vercel dev`, then deploy and verify sign-in,
   workspace creation, memory listing, API-key creation/revocation, and the
   public `/health` route.

The Next.js proxy validates NextAuth, removes caller-supplied identity and API
key headers, and signs the stable NextAuth subject with `SYNRA_SESSION_SECRET`.
The FastAPI service verifies that signature and checks workspace ownership.
MCP/Chrome Extension requests authenticate directly with a generated scoped key.

## 5. Configure MCP and the Chrome extension

1. Sign in and create a workspace in the dashboard.
2. Open Connections and generate a workspace-scoped API key. Copy it immediately;
   the raw key is returned only once. Revoke and replace it if it is lost or
   exposed.
3. Copy the generated MCP configuration into Cursor or Claude. Update the local
   `--prefix` path to this checkout's `mcp-server` directory. The configuration
   uses the package's `npm run start` command and the `SYNRA_API_BASE_URL` and
   `SYNRA_API_KEY` variables read by `mcp-server/index.ts`.
4. Build the extension with `PLASMO_PUBLIC_API_BASE_URL` set to the backend
   origin (for example `https://<render-service>`), then paste a generated
   workspace key in its popup. The extension calls `/api/v1/memory/add`.
5. Use the workspace ID shown in Settings as the project/workspace identifier
   when configuring an integration client.

## 6. Local development and verification

1. Copy `backend/.env.example` to `backend/.env` and configure Supabase, or leave
   its credentials empty to receive explicit database-unavailable responses.
2. Set `APP_ENV=development`, `SYNRA_SESSION_SECRET`, and the matching values in
   `dashboard/.env.local`. Keep `.env` files out of version control.
3. Start FastAPI and Next.js locally. In development, sign in with the local
   email/password Credentials provider; Google sign-in is available only when
   valid OAuth credentials are configured. Create a workspace, then create an
   integration key from Connections.
4. Run backend tests with
   `python -m unittest discover -s backend/tests -v`, and dashboard checks with
   `pnpm --dir dashboard build` and `pnpm --dir dashboard lint`.

Production deployment remains pending until real Supabase, OAuth, Render, and
AgentMemory service configuration is supplied and live health checks pass.
