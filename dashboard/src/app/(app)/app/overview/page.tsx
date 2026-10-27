"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  buildMemoriesUrl,
  getErrorMessage,
  useWorkspaceIdFromCookie,
  type MemoryItem,
  type MemoryListResponse,
} from "@/lib/memories";

const staticStats = [
  { label: "Sources connected", value: "0", note: "Connect a source to begin" },
  { label: "Last sync", value: "Not synced", note: "No sync activity yet" },
  { label: "Plan", value: "Free", note: "Workspace plan" },
];

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function OverviewPage() {
  const workspaceId = useWorkspaceIdFromCookie();
  const [total, setTotal] = useState<number | null>(null);
  const [recent, setRecent] = useState<MemoryItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadOverview() {
      if (!workspaceId) {
        setError("Workspace not found. Complete onboarding to load memory statistics.");
        setTotal(0);
        return;
      }

      try {
        const response = await fetch(
          buildMemoriesUrl(workspaceId, { limit: 3, offset: 0 }),
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) throw new Error(await getErrorMessage(response));
        const result = (await response.json()) as MemoryListResponse;
        setTotal(result.total);
        setRecent(result.items);
      } catch (caughtError) {
        if (caughtError instanceof DOMException && caughtError.name === "AbortError") return;
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load memory statistics.");
      }
    }

    void loadOverview();
    return () => controller.abort();
  }, [workspaceId]);

  const stats = [
    {
      label: "Total memories",
      value: total === null ? "Loading…" : String(total),
      note: error || (total === 0 ? "Your workspace is ready" : "Indexed in this workspace"),
    },
    ...staticStats,
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <p className="text-sm text-neutral-400">Your team’s shared engineering memory.</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">Workspace overview</h2>
      </div>
      <section aria-label="Workspace statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="glass-panel rounded-md border border-neutral-800 bg-black p-5"
            style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
          >
            <p className="text-sm text-neutral-400">{stat.label}</p>
            <p className="mt-4 text-2xl font-semibold text-white">{stat.value}</p>
            <p className={`mt-2 text-xs ${error && stat.label === "Total memories" ? "text-rose-300" : "text-neutral-500"}`}>
              {stat.note}
            </p>
          </article>
        ))}
      </section>
      <section
        className="glass-panel rounded-md border border-neutral-800 bg-black"
        style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
      >
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
          <h3 className="text-sm font-semibold text-white">Recent memories</h3>
          {total ? (
            <Link href="/app/memories" className="text-xs font-medium text-white underline-offset-4 hover:underline">
              View all
            </Link>
          ) : null}
        </div>
        {recent.length ? (
          <div className="divide-y divide-neutral-800">
            {recent.map((item) => (
              <Link
                key={item.id}
                href={`/app/memories/${encodeURIComponent(item.id)}`}
                className="flex flex-col gap-2 px-5 py-4 transition hover:bg-neutral-900 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="line-clamp-2 whitespace-pre-line break-words text-sm leading-6 text-neutral-200">
                  {item.content || "(Empty memory)"}
                </span>
                <span className="shrink-0 text-xs text-neutral-500">{formatDate(item.created_at)}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid min-h-64 place-items-center p-8 text-center">
            <div>
              <div className="mx-auto grid size-12 place-items-center rounded-md border border-neutral-800 bg-neutral-950 text-neutral-300">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M5 4.5h14v15H5zM8 8h8M8 12h8M8 16h5" />
                </svg>
              </div>
              <h4 className="mt-4 text-sm font-medium text-neutral-200">
                {error ? "Memories are unavailable" : "No memories yet"}
              </h4>
              <p className="mt-1 max-w-sm text-sm leading-6 text-neutral-500">
                {error || "Add a memory or connect a source to start building your team’s knowledge graph."}
              </p>
              {!error && total === 0 ? (
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
