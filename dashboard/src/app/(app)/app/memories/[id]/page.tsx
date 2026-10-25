"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getErrorMessage,
  useWorkspaceIdFromCookie,
  type MemoryItem,
} from "@/lib/memories";

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" }).format(date);
}

export default function MemoryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const memoryId = Array.isArray(params.id) ? params.id[0] : params.id;
  const workspaceId = useWorkspaceIdFromCookie();
  const [memory, setMemory] = useState<MemoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadMemory() {
      if (!workspaceId) {
        setError("Workspace not found. Complete onboarding before opening memories.");
        setLoading(false);
        return;
      }

      try {
        const query = new URLSearchParams({ workspace_id: workspaceId });
        const response = await fetch(
          `/backend/api/v1/memories/${encodeURIComponent(memoryId)}?${query.toString()}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) throw new Error(await getErrorMessage(response));
        setMemory((await response.json()) as MemoryItem);
      } catch (caughtError) {
        if (caughtError instanceof DOMException && caughtError.name === "AbortError") return;
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load this memory.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadMemory();
    return () => controller.abort();
  }, [memoryId, workspaceId]);

  async function deleteMemory() {
    if (!workspaceId || deleting) return;

    setDeleting(true);
    setError("");
    try {
      const query = new URLSearchParams({ workspace_id: workspaceId });
      const response = await fetch(
        `/backend/api/v1/memories/${encodeURIComponent(memoryId)}?${query.toString()}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error(await getErrorMessage(response));
      router.push("/app/memories");
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to delete this memory.");
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/app/memories" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white">
        <span aria-hidden="true">←</span>
        Back to memories
      </Link>

      {error ? (
        <div role="alert" className="rounded-md border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-neutral-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid min-h-64 place-items-center rounded-md border border-neutral-800 bg-black text-sm text-neutral-400">
          Loading memory…
        </div>
      ) : memory ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-neutral-400">{memory.event_type}</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">Memory details</h2>
            </div>
            <button
              type="button"
              onClick={() => void deleteMemory()}
              disabled={deleting}
              className="rounded-md border border-neutral-800 px-4 py-2.5 text-sm font-medium text-neutral-300 hover:bg-neutral-900 disabled:cursor-wait disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete memory"}
            </button>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <section className="min-w-0 rounded-md border border-neutral-800 bg-black p-5 sm:p-7">
              <h3 className="text-sm font-semibold text-neutral-200">Content</h3>
              <div className="mt-5 space-y-6">
                {memory.prompt ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Prompt</p>
                    <p className="whitespace-pre-wrap break-words text-sm leading-7 text-neutral-200">{memory.prompt}</p>
                  </div>
                ) : null}
                {memory.response ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Response</p>
                    <p className="whitespace-pre-wrap break-words text-sm leading-7 text-neutral-200">{memory.response}</p>
                  </div>
                ) : null}
                {!memory.prompt && !memory.response ? (
                  <p className="whitespace-pre-wrap break-words text-sm leading-7 text-neutral-200">{memory.content || "(Empty memory)"}</p>
                ) : null}
              </div>
            </section>

            <aside className="h-fit rounded-md border border-neutral-800 bg-black p-5">
              <h3 className="text-sm font-semibold text-neutral-200">Memory metadata</h3>
              <dl className="mt-5 space-y-4">
                <div>
                  <dt className="text-xs text-neutral-500">Source</dt>
                  <dd className="mt-1 break-words text-sm text-neutral-200">{memory.source}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Created</dt>
                  <dd className="mt-1 text-sm text-neutral-200">{formatDate(memory.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Workspace</dt>
                  <dd className="mt-1 break-words text-sm text-neutral-200">{memory.workspace_id}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Project</dt>
                  <dd className="mt-1 break-words text-sm text-neutral-200">{memory.project_id}</dd>
                </div>
                {Object.keys(memory.metadata).length ? (
                  <div>
                    <dt className="text-xs text-neutral-500">Additional metadata</dt>
                    <dd className="mt-1">
                      <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-neutral-800 bg-neutral-950 p-3 font-mono text-xs leading-5 text-neutral-300">
                        {JSON.stringify(memory.metadata, null, 2)}
                      </pre>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </aside>
          </div>
        </>
      ) : !error ? (
        <div className="grid min-h-64 place-items-center rounded-md border border-neutral-800 bg-black text-sm text-neutral-400">
          Memory not found.
        </div>
      ) : null}
    </div>
  );
}
