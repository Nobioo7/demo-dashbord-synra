"use client";

import { useState } from "react";

const API_BASE_URL = "/backend";

type GitHubSyncButtonProps = {
  projectId: string;
  onSynced: () => void;
};

type SyncResult = {
  items_ingested: number;
  code_files: number;
  detail?: string;
};

export default function GitHubSyncButton({ projectId, onSynced }: GitHubSyncButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function syncRepository() {
    setSyncing(true);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/integrations/github/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, include_code: true }),
      });
      const data = (await response.json()) as SyncResult;
      if (!response.ok) throw new Error(data.detail ?? `GitHub sync returned ${response.status}`);
      setMessage(`Imported ${data.items_ingested} memories from ${data.code_files} source files.`);
      onSynced();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sync GitHub.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void syncRepository()}
        disabled={syncing}
        className="rounded-md border border-neutral-800 bg-white px-3 py-2 text-sm font-medium text-black transition-colors duration-200 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {syncing ? "Syncing repository…" : "Sync GitHub repository"}
      </button>
      {message && <p className="max-w-72 text-xs leading-5 text-neutral-400" role="status">{message}</p>}
    </div>
  );
}
