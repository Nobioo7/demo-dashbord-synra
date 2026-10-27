"use client";

import { useState } from "react";
import GitHubSyncButton from "@/components/GitHubSyncButton";
import IngestModal from "@/components/IngestModal";
import { useWorkspaceIdFromCookie } from "@/lib/memories";

type IngestJob = {
  id: string;
  project_id: string;
  status: string;
  progress: number;
  message: string;
  updated_at: string;
};

function GitHubIngestCard() {
  const projectId = useWorkspaceIdFromCookie();
  const [job, setJob] = useState<IngestJob | null>(null);
  const [jobError, setJobError] = useState("");

  async function checkJobStatus() {
    if (!projectId) return;
    setJobError("");
    setJob({
      id: "pending",
      project_id: projectId,
      status: "processing",
      progress: 20,
      message: "Checking sync status…",
      updated_at: new Date().toISOString(),
    });
    await new Promise((resolve) => window.setTimeout(resolve, 250));

    try {
      const query = new URLSearchParams({ project_id: projectId });
      const response = await fetch(`/backend/api/v1/ingest/jobs?${query.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Job status returned ${response.status}.`);
      const result = (await response.json()) as { items?: IngestJob[] };
      const completedJob = result.items?.[0];
      if (!completedJob) throw new Error("No sync job status was returned.");
      setJob(completedJob);
    } catch (error) {
      setJob(null);
      setJobError(error instanceof Error ? error.message : "Unable to retrieve sync status.");
    }
  }

  return (
    <article
      className="glass-panel flex h-full flex-col rounded-md border border-neutral-800 bg-black p-5 transition-all hover:border-white/20 sm:p-6"
      style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="grid size-11 place-items-center rounded-md border border-neutral-800 bg-neutral-950 text-neutral-300">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="currentColor">
            <path d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.5-1.3-1.25-1.64-1.25-1.64-1.02-.7.08-.69.08-.69 1.12.08 1.71 1.15 1.71 1.15 1 .1.77 2.15 3.36 1.52.1-.73.39-1.23.7-1.52-2.5-.29-5.13-1.25-5.13-5.56 0-1.23.44-2.24 1.15-3.03-.12-.29-.5-1.44.11-2.99 0 0 .94-.3 3.08 1.16a10.7 10.7 0 0 1 5.6 0c2.14-1.45 3.08-1.16 3.08-1.16.62 1.55.23 2.7.11 2.99.72.79 1.15 1.8 1.15 3.03 0 4.32-2.63 5.27-5.14 5.55.4.35.75 1.03.75 2.08v3.08c0 .3.2.65.78.54A11.2 11.2 0 0 0 12 .8Z" />
          </svg>
        </div>
        <span className="rounded-md border border-neutral-800 bg-neutral-950 px-2.5 py-1 text-xs text-neutral-300">
          Repository sync
        </span>
      </div>
      <h2 className="mt-5 text-lg font-semibold text-white">GitHub</h2>
      <p className="mt-2 min-h-12 text-sm leading-6 text-neutral-400">
        Import repository activity and code context into this workspace.
      </p>
      <div className="mt-5">
        {projectId ? (
          <GitHubSyncButton projectId={projectId} onSynced={() => void checkJobStatus()} />
        ) : (
          <p className="text-sm text-neutral-500">Loading workspace…</p>
        )}
      </div>
      {job ? (
        <div className="mt-5 rounded-md border border-neutral-800 bg-neutral-950 p-4" role="status" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-neutral-300">{job.message}</span>
            <span className="shrink-0 text-white">{job.progress}%</span>
          </div>
          <div
            className="mt-3 h-1 overflow-hidden rounded-sm bg-neutral-800"
            role="progressbar"
            aria-label="GitHub sync progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={job.progress}
          >
            <div
              className="h-full rounded-sm bg-white transition-all duration-500"
              style={{ width: `${Math.max(0, Math.min(100, job.progress))}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] capitalize text-neutral-500">Job status: {job.status}</p>
        </div>
      ) : null}
      {jobError ? <p role="alert" className="mt-3 text-xs text-neutral-400">{jobError}</p> : null}
    </article>
  );
}

function GmailIngestCard() {
  const [message, setMessage] = useState("");

  return (
    <article
      className="glass-panel flex h-full flex-col rounded-md border border-neutral-800 bg-black p-5 transition-all hover:border-white/20 sm:p-6"
      style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="grid size-11 place-items-center rounded-md border border-neutral-800 bg-neutral-950 text-lg font-semibold text-neutral-300">
          M
        </div>
        <span className="rounded-md border border-neutral-800 bg-neutral-950 px-2.5 py-1 text-xs text-neutral-400">
          OAuth
        </span>
      </div>
      <h2 className="mt-5 text-lg font-semibold text-white">Gmail</h2>
      <p className="mt-2 min-h-12 text-sm leading-6 text-neutral-400">
        Connect a mailbox to make useful email context searchable by your team.
      </p>
      <div className="mt-auto pt-5">
        <button
          type="button"
          onClick={() => setMessage("Gmail OAuth setup is not configured yet. No account was connected.")}
          className="rounded-md border border-neutral-800 px-4 py-2.5 text-sm font-medium text-neutral-200 transition hover:bg-neutral-900"
        >
          Connect Gmail
        </button>
        {message ? <p role="status" className="mt-3 text-xs leading-5 text-neutral-400">{message}</p> : null}
      </div>
    </article>
  );
}

function ManualIngestCard() {
  const projectId = useWorkspaceIdFromCookie();
  const [saved, setSaved] = useState(false);

  return (
    <article
      className="glass-panel flex h-full flex-col rounded-md border border-neutral-800 bg-black p-5 transition-all hover:border-white/20 sm:p-6"
      style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="grid size-11 place-items-center rounded-md border border-neutral-800 bg-neutral-950 text-xl text-neutral-300">
          +
        </div>
        <span className="rounded-md border border-neutral-800 bg-neutral-950 px-2.5 py-1 text-xs text-neutral-400">
          Direct entry
        </span>
      </div>
      <h2 className="mt-5 text-lg font-semibold text-white">Manual memory</h2>
      <p className="mt-2 min-h-12 text-sm leading-6 text-neutral-400">
        Add a prompt, response, or useful project note directly to this workspace.
      </p>
      <div className="mt-auto pt-5">
        {projectId ? (
          <IngestModal projectId={projectId} onIngested={() => setSaved(true)} />
        ) : (
          <p className="text-sm text-neutral-500">Loading workspace…</p>
        )}
        {saved ? <p role="status" className="mt-3 text-xs text-neutral-300">Memory added to this workspace.</p> : null}
      </div>
    </article>
  );
}

export default function IngestCards() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-sm text-neutral-400">Choose how to add knowledge to the workspace.</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Ingest memory</h1>
      </div>
      <section aria-label="Memory ingestion options" className="grid gap-4 lg:grid-cols-3">
        <GitHubIngestCard />
        <GmailIngestCard />
        <ManualIngestCard />
      </section>
      <p className="text-xs leading-5 text-neutral-500">
        GitHub sync uses the configured backend integration. Gmail connection is a placeholder until OAuth
        credentials and consent flow are set up.
      </p>
    </div>
  );
}
