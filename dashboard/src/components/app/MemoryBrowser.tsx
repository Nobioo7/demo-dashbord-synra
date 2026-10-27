"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  buildMemoriesUrl,
  getErrorMessage,
  useWorkspaceIdFromCookie,
  type MemoryItem,
  type MemoryListResponse,
} from "@/lib/memories";

const PAGE_SIZE = 20;

function sourceLabel(source: string): string {
  if (source === "dashboard") return "Manual";
  return source ? source.charAt(0).toUpperCase() + source.slice(1) : "Unknown";
}

function sourceClasses(): string {
  return "source-pill border border-white/10 bg-white/5 text-xs text-white/70";
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function MemoryBrowser() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [source, setSource] = useState("all");
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const workspaceId = useWorkspaceIdFromCookie();

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadItems = useCallback(async (signal: AbortSignal) => {
    if (!workspaceId) {
      setItems([]);
      setTotal(0);
      setError("Workspace not found. Complete onboarding before browsing memories.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        buildMemoriesUrl(workspaceId, {
          q: debouncedSearch,
          source: source === "all" ? undefined : source,
          limit: PAGE_SIZE,
          offset: 0,
        }),
        { cache: "no-store", signal },
      );
      if (!response.ok) throw new Error(await getErrorMessage(response));
      const result = (await response.json()) as MemoryListResponse;
      setItems(result.items);
      setTotal(result.total);
    } catch (caughtError) {
      if (caughtError instanceof DOMException && caughtError.name === "AbortError") return;
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load memories.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [debouncedSearch, source, workspaceId]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void loadItems(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadItems]);

  async function loadMore() {
    if (!workspaceId || loadingMore || items.length >= total) return;

    setLoadingMore(true);
    setError("");
    try {
      const response = await fetch(
        buildMemoriesUrl(workspaceId, {
          q: debouncedSearch,
          source: source === "all" ? undefined : source,
          limit: PAGE_SIZE,
          offset: items.length,
        }),
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(await getErrorMessage(response));
      const result = (await response.json()) as MemoryListResponse;
      setItems((current) => [...current, ...result.items]);
      setTotal(result.total);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load more memories.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function deleteMemory(memoryId: string) {
    if (!workspaceId || deletingId) return;
    setDeletingId(memoryId);
    setError("");
    try {
      const query = new URLSearchParams({ workspace_id: workspaceId });
      const response = await fetch(
        `/backend/api/v1/memories/${encodeURIComponent(memoryId)}?${query.toString()}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error(await getErrorMessage(response));
      setItems((current) => current.filter((item) => item.id !== memoryId));
      setTotal((current) => Math.max(0, current - 1));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to delete memory.");
    } finally {
      setDeletingId(null);
    }
  }

  const isFiltered = Boolean(debouncedSearch) || source !== "all";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-400">Search and manage your workspace knowledge.</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">Memories</h2>
        </div>
        <p className="text-sm text-neutral-400" aria-live="polite">
          {loading ? "Loading…" : `${total} ${total === 1 ? "memory" : "memories"}`}
        </p>
      </div>

      <section className="memory-table rounded-2xl border border-white/10 bg-[#0e1014]">
        <div className="flex flex-col gap-3 border-b border-neutral-800 p-4 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search memories</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="10.8" cy="10.8" r="6.8" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search memory content…"
              className="w-full rounded-md border border-neutral-800 bg-black py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-neutral-500"
            />
          </label>
          <label className="sm:w-52">
            <span className="sr-only">Filter by source</span>
            <select
              value={source}
              onChange={(event) => setSource(event.target.value)}
              className="w-full rounded-md border border-neutral-800 bg-black px-3 py-3 text-sm text-neutral-200 outline-none focus:border-neutral-500"
            >
              <option value="all">All sources</option>
              <option value="github">GitHub</option>
              <option value="agentmemory">AgentMemory</option>
              <option value="manual">Manual</option>
            </select>
          </label>
        </div>

        {error ? (
          <div role="alert" className="border-b border-neutral-800 bg-neutral-950 px-5 py-3 text-sm text-neutral-300">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="grid min-h-64 place-items-center text-sm text-neutral-400">Loading memories…</div>
        ) : items.length > 0 ? (
          <div className="divide-y divide-neutral-800">
            {items.map((item) => (
              <article key={item.id} className="memory-row flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/app/memories/${encodeURIComponent(item.id)}`}
                    className="block whitespace-pre-line break-words text-sm leading-6 text-neutral-200 hover:text-white"
                  >
                    {item.content || "(Empty memory)"}
                  </Link>
                  <p className="mt-2 text-xs text-neutral-500">{formatDate(item.created_at)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className={`rounded-full border px-2.5 py-1 ${sourceClasses()}`}>
                    {sourceLabel(item.source)}
                  </span>
                  <Link
                    href={`/app/memories/${encodeURIComponent(item.id)}`}
                    className="rounded-md px-2.5 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-900 hover:text-white"
                  >
                    View
                  </Link>
                  <button
                    type="button"
                    onClick={() => void deleteMemory(item.id)}
                    disabled={deletingId !== null}
                    className="rounded-md px-2.5 py-2 text-xs font-medium text-neutral-400 hover:bg-neutral-900 hover:text-white disabled:cursor-wait disabled:opacity-50"
                  >
                    {deletingId === item.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </article>
            ))}
            {items.length < total ? (
              <div className="p-4 text-center">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="rounded-md border border-neutral-800 px-4 py-2.5 text-sm font-medium text-neutral-200 hover:bg-neutral-900 disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid min-h-72 place-items-center p-8 text-center">
            <div>
              <div className="mx-auto grid size-12 place-items-center rounded-md border border-neutral-800 bg-neutral-950 text-neutral-300">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M5 4.5h14v15H5zM8 8h8M8 12h8M8 16h5" />
                </svg>
              </div>
              <h3 className="mt-4 text-sm font-medium text-neutral-200">
                {isFiltered ? "No matching memories" : "No memories yet"}
              </h3>
              <p className="mt-1 max-w-sm text-sm leading-6 text-neutral-500">
                {isFiltered
                  ? "Try another search or choose a different source."
                  : "Add a memory to start building your workspace knowledge."}
              </p>
              {!isFiltered ? (
                <Link
                  href="/app/ingest"
                  className="mt-5 inline-flex rounded-md bg-white px-4 py-2.5 text-sm font-medium text-black hover:bg-neutral-200"
                >
                  Add a memory
                </Link>
              ) : null}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
