"use client";

import { useEffect, useMemo, useState } from "react";
import { getErrorMessage, useWorkspaceIdFromCookie } from "@/lib/memories";

const API_BASE_URL = "/backend";
const SYNRA_API_BASE_URL = (
  process.env.NEXT_PUBLIC_SYNRA_API_BASE_URL?.trim()
  || (process.env.NODE_ENV === "production" ? "" : "http://127.0.0.1:8000/api/v1")
).replace(/\/+$/, "");

type ApiKey = {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
};

type CreatedApiKey = ApiKey & { key: string };

function createMcpConfiguration(key: string) {
  return JSON.stringify(
    {
      mcpServers: {
        synra: {
          command: "npm",
          args: ["--prefix", "C:\\path\\to\\Saynra-software\\mcp-server", "run", "start"],
          env: {
            SYNRA_API_BASE_URL,
            SYNRA_API_KEY: key,
          },
        },
      },
    },
    null,
    2,
  );
}

type SourceState = {
  connected: boolean;
  message: string;
};

function ConnectionSource({
  name,
  description,
  connected,
  onToggle,
  note,
}: {
  name: string;
  description: string;
  connected: boolean;
  onToggle: () => void;
  note: string;
}) {
  return (
    <article
      className="glass-panel rounded-md border border-neutral-800 bg-black p-5"
      style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-md border border-neutral-800 bg-neutral-950 text-sm font-semibold text-neutral-200">
            {name === "GitHub" ? "GH" : "G"}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{name}</h3>
            <p className="mt-1 text-xs leading-5 text-neutral-400">{description}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs ${
          connected
            ? "border-neutral-700 bg-neutral-900 text-neutral-200"
            : "border-neutral-800 bg-neutral-950 text-neutral-500"
        }`}>
          <span className={`size-1.5 rounded-sm ${connected ? "bg-white" : "bg-neutral-600"}`} />
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>
      <p className="mt-4 text-xs leading-5 text-neutral-500">{note}</p>
      <button
        type="button"
        onClick={onToggle}
        className="mt-4 rounded-md border border-neutral-800 px-3 py-2 text-xs font-medium text-neutral-300 transition hover:bg-neutral-900 hover:text-white"
      >
        {connected ? "Disconnect" : "Connect"}
      </button>
    </article>
  );
}

export default function ConnectionsPanel() {
  const workspaceId = useWorkspaceIdFromCookie();
  const [sources, setSources] = useState<Record<string, SourceState>>({
    github: { connected: true, message: "" },
    gmail: { connected: true, message: "" },
  });
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [keyError, setKeyError] = useState("");
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);
  const mcpConfiguration = useMemo(
    () => createMcpConfiguration(createdKey?.key ?? "generate-a-key-first"),
    [createdKey],
  );

  useEffect(() => {
    if (workspaceId === null) return;
    const currentWorkspaceId: string = workspaceId;
    const controller = new AbortController();

    async function loadKeys() {
      setLoadingKeys(true);
      setKeyError("");
      try {
        const query = new URLSearchParams({ workspace_id: currentWorkspaceId });
        const response = await fetch(`${API_BASE_URL}/api/v1/api-keys?${query}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(await getErrorMessage(response));
        setApiKeys((await response.json()) as ApiKey[]);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setKeyError(error instanceof Error ? error.message : "Unable to load API keys.");
      } finally {
        if (!controller.signal.aborted) setLoadingKeys(false);
      }
    }

    void loadKeys();
    return () => controller.abort();
  }, [workspaceId]);

  async function createApiKey() {
    if (!workspaceId) {
      setKeyError("Workspace is unavailable. Complete onboarding before creating a key.");
      return;
    }
    setCreatingKey(true);
    setKeyError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          name: "MCP / Chrome Extension",
        }),
      });
      if (!response.ok) throw new Error(await getErrorMessage(response));
      const key = (await response.json()) as CreatedApiKey;
      if (!key.id || !key.key) throw new Error("The backend returned an invalid API key.");
      setCreatedKey(key);
      setApiKeys((current) => [key, ...current]);
    } catch (error) {
      setKeyError(error instanceof Error ? error.message : "Unable to create API key.");
    } finally {
      setCreatingKey(false);
    }
  }

  async function revokeApiKey(keyId: string) {
    if (!workspaceId) return;
    setRevokingKeyId(keyId);
    setKeyError("");
    try {
      const query = new URLSearchParams({ workspace_id: workspaceId });
      const response = await fetch(
        `${API_BASE_URL}/api/v1/api-keys/${encodeURIComponent(keyId)}?${query}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error(await getErrorMessage(response));
      setApiKeys((current) => current.filter((key) => key.id !== keyId));
      setCreatedKey((current) => current?.id === keyId ? null : current);
    } catch (error) {
      setKeyError(error instanceof Error ? error.message : "Unable to revoke API key.");
    } finally {
      setRevokingKeyId(null);
    }
  }

  function toggleSource(source: "github" | "gmail") {
    setSources((current) => {
      const connected = !current[source].connected;
      return {
        ...current,
        [source]: {
          connected,
          message: connected
            ? `${source === "github" ? "GitHub" : "Gmail"} demo status marked connected. Configure provider credentials for live sync.`
            : `${source === "github" ? "GitHub" : "Gmail"} demo status disconnected. Provider credentials are not changed.`,
        },
      };
    });
  }

  async function copyApiKey() {
    if (!createdKey) return;
    setCopyError("");
    try {
      await navigator.clipboard.writeText(createdKey.key);
    } catch {
      setCopyError("Clipboard access failed. Select and copy the key text.");
    }
  }

  async function copyConfiguration() {
    if (!createdKey) {
      setCopyError("Generate a new API key before copying the MCP configuration.");
      return;
    }
    if (!SYNRA_API_BASE_URL) {
      setCopyError("Set NEXT_PUBLIC_SYNRA_API_BASE_URL before copying the MCP configuration.");
      return;
    }
    setCopyError("");
    try {
      await navigator.clipboard.writeText(mcpConfiguration);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError("Clipboard access failed. Select and copy the configuration text.");
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <p className="text-sm text-neutral-400">Manage integrations and connect your AI coding tools.</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">Connections</h2>
      </div>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Connected sources</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Status toggles are local preview controls; they do not add or revoke provider credentials.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ConnectionSource
            name="GitHub"
            description="Repository activity and code context."
            connected={sources.github.connected}
            note={sources.github.message || "Demo status only. Live sync requires GitHub credentials in the backend configuration."}
            onToggle={() => toggleSource("github")}
          />
          <ConnectionSource
            name="Gmail"
            description="Email context for your engineering workspace."
            connected={sources.gmail.connected}
            note={sources.gmail.message || "Demo status only. Gmail OAuth is not configured; no mailbox has been authorized."}
            onToggle={() => toggleSource("gmail")}
          />
        </div>
      </section>

      <section
        className="glass-panel rounded-md border border-neutral-800 bg-black p-5 sm:p-6"
        style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">MCP setup</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Connect Cursor or Claude</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
              Generate a workspace-scoped key, then copy this entry into your MCP client. The raw key
              is shown only after creation and is never retrievable from Synra.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void createApiKey()}
            disabled={creatingKey || !workspaceId}
            className="rounded-md bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creatingKey ? "Generating…" : "Generate API key"}
          </button>
        </div>
        {keyError ? <p role="alert" className="mt-4 text-sm text-rose-300">{keyError}</p> : null}
        {createdKey ? (
          <div className="mt-5 rounded-md border border-neutral-700 bg-neutral-950 p-4">
            <p className="text-xs font-medium text-neutral-200">Copy this key now. It will not be shown again.</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <code className="min-w-0 flex-1 break-all font-mono text-sm text-white">{createdKey.key}</code>
              <button
                type="button"
                onClick={() => void copyApiKey()}
                className="rounded-md border border-neutral-700 px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-900"
              >
                Copy key
              </button>
            </div>
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-sm font-medium text-neutral-200">Active integration keys</h4>
          <button
            type="button"
            onClick={() => void copyConfiguration()}
            disabled={!createdKey || !SYNRA_API_BASE_URL}
            className="rounded-md border border-neutral-800 px-3 py-2 text-xs font-medium text-neutral-200 transition hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copied ? "Copied" : "Copy MCP configuration"}
          </button>
        </div>
        {loadingKeys ? <p className="mt-3 text-xs text-neutral-500">Loading keys…</p> : null}
        {!loadingKeys && apiKeys.length === 0 ? (
          <p className="mt-3 text-xs text-neutral-500">No active keys for this workspace.</p>
        ) : null}
        {apiKeys.length > 0 ? (
          <ul className="mt-3 divide-y divide-neutral-800 rounded-md border border-neutral-800">
            {apiKeys.map((key) => (
              <li key={key.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm text-neutral-200">{key.name}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Created {new Date(key.created_at).toLocaleDateString()}
                    {key.last_used_at ? ` · Last used ${new Date(key.last_used_at).toLocaleDateString()}` : " · Never used"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void revokeApiKey(key.id)}
                  disabled={revokingKeyId === key.id}
                  className="rounded-md border border-neutral-800 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-900 disabled:opacity-50"
                >
                  {revokingKeyId === key.id ? "Revoking…" : "Revoke"}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-4 text-xs leading-5 text-neutral-500">
          Update the <code className="font-mono text-neutral-300">C:\\path\\to\\Saynra-software\\mcp-server</code>
          {" "}placeholder to your local package path. API base:{" "}
          <code className="break-all font-mono text-neutral-300">{SYNRA_API_BASE_URL || "not configured"}</code>
        </p>
        <pre className="mt-4 overflow-x-auto rounded-md border border-neutral-800 bg-black p-4 font-mono text-sm leading-6 text-neutral-200">
          <code>{mcpConfiguration}</code>
        </pre>
        {copyError ? <p role="alert" className="mt-3 text-xs text-neutral-400">{copyError}</p> : null}
        <div className="mt-4 rounded-md border border-neutral-800 bg-neutral-950 p-4 text-xs leading-5 text-neutral-400">
          <p>
            The command uses the <code className="font-mono text-neutral-200">mcp-server</code> package start script
            (<code className="font-mono text-neutral-200">node --env-file=.env --import tsx index.ts</code>).
          </p>
          <p className="mt-2">
            The extension build uses <code className="font-mono text-neutral-200">PLASMO_PUBLIC_API_BASE_URL</code>
            {" "}for its backend root and the same generated API key for authentication.
          </p>
        </div>
      </section>

      <section
        className="glass-panel rounded-md border border-neutral-800 bg-black p-5 sm:p-6"
        style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
      >
        <div className="flex items-start gap-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-md border border-neutral-800 bg-neutral-950 text-neutral-300">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M4 5.5h16v13H4zM8 5.5V3m8 2.5V3M8 10h8M8 14h5" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Pair the Chrome extension</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm leading-6 text-neutral-400 marker:text-neutral-300">
              <li>Build and load the extension from the local <code className="font-mono text-neutral-200">extension</code> folder in Chrome.</li>
              <li>Open the extension popup and paste a workspace-scoped API key generated above.</li>
              <li>Save the key. It is stored in Chrome local storage on this device.</li>
              <li>Build with <code className="font-mono text-neutral-200">PLASMO_PUBLIC_API_BASE_URL</code> set to the backend URL.</li>
              <li>On ChatGPT or Claude, use the Synra capture button and enter the workspace ID shown in Settings.</li>
            </ol>
            <p className="mt-4 rounded-md border border-neutral-800 bg-neutral-950 p-3 text-xs leading-5 text-neutral-400">
              Generate separate keys for each client when possible. Revoke any exposed key from this page.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
