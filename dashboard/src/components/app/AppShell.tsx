"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, type ReactNode } from "react";
import IngestModal from "@/components/IngestModal";

type AppUser = { name: string | null; email: string | null };
type NavItem = { href: string; label: string; icon: "overview" | "graph" | "memories" | "ingest" | "connections" | "settings" };

const navigation: NavItem[] = [
  { href: "/app/overview", label: "Overview", icon: "overview" },
  { href: "/app/graph", label: "Graph", icon: "graph" },
  { href: "/app/memories", label: "Memories", icon: "memories" },
  { href: "/app/ingest", label: "Ingest", icon: "ingest" },
  { href: "/app/connections", label: "Connections", icon: "connections" },
  { href: "/app/settings", label: "Settings", icon: "settings" },
];

const titles: Record<string, string> = {
  "/app/overview": "Overview",
  "/app/graph": "Memory graph",
  "/app/memories": "Memories",
  "/app/ingest": "Ingest",
  "/app/connections": "Connections",
  "/app/settings": "Settings",
};

function NavIcon({ name }: { name: NavItem["icon"] }) {
  const shared = {
    "aria-hidden": true as const,
    className: "size-[18px] shrink-0",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    viewBox: "0 0 24 24",
  };

  switch (name) {
    case "overview":
      return <svg {...shared}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></svg>;
    case "graph":
      return <svg {...shared}><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="8" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="m8.2 7 7.5 1M7.3 8.2l3.4 7.4m5.9-5.4-3.5 5.5" /></svg>;
    case "memories":
      return <svg {...shared}><path d="M5 4.5h14v15H5zM8 8h8M8 12h8M8 16h5" /><path d="M3 7v14h14" /></svg>;
    case "ingest":
      return <svg {...shared}><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" /></svg>;
    case "connections":
      return <svg {...shared}><circle cx="7" cy="7" r="3" /><circle cx="17" cy="17" r="3" /><path d="m9.2 9.2 5.6 5.6M14 5h5v5" /></svg>;
    case "settings":
      return <svg {...shared}><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 0 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 0 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3h-.2a1.8 1.8 0 0 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 0 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 0 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 0 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 0 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z" /></svg>;
  }
}

function Sidebar({
  workspaceName,
  user,
  pathname,
  onNavigate,
}: {
  workspaceName: string;
  user: AppUser;
  pathname: string;
  onNavigate: () => void;
}) {
  const displayName = user.name || user.email || "Synra member";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex h-full flex-col bg-black">
      <Link href="/app/overview" className="flex h-16 items-center gap-3 border-b border-neutral-800 px-5" onClick={onNavigate}>
        <span className="grid size-9 place-items-center rounded-md border border-neutral-800 bg-neutral-950 font-semibold text-white">S</span>
        <span className="text-sm font-semibold tracking-[0.2em] text-white">SYNRA</span>
      </Link>
      <div className="mx-4 mt-5 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Workspace</p>
        <p className="mt-1 truncate text-sm font-medium text-neutral-200">{workspaceName}</p>
      </div>
      <nav aria-label="Main navigation" className="mt-6 flex-1 space-y-1 px-3">
        {navigation.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-sm transition ${
                active
                  ? "border-white bg-neutral-900 font-medium text-white"
                  : "border-transparent text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
              }`}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-neutral-800 p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-800 text-sm font-semibold text-white">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-neutral-100">{displayName}</p>
            <p className="truncate text-xs text-neutral-500">{user.email || "Google account"}</p>
          </div>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/login" })}
            aria-label="Sign out"
            title="Sign out"
            className="rounded-md p-2 text-neutral-400 transition hover:bg-neutral-900 hover:text-white"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M10 17l5-5-5-5M15 12H3M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppShell({
  children,
  workspaceName,
  workspaceId,
  user,
}: {
  children: ReactNode;
  workspaceName: string;
  workspaceId: string;
  user: AppUser;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const title = titles[pathname] || "Workspace";

  return (
    <div className="dashboard-shell min-h-screen bg-black text-neutral-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-neutral-800 lg:block">
        <Sidebar workspaceName={workspaceName} user={user} pathname={pathname} onNavigate={() => undefined} />
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/70"
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-neutral-800 shadow-2xl">
            <Sidebar workspaceName={workspaceName} user={user} pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-neutral-800 bg-black px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setDrawerOpen(true)}
              className="rounded-md p-2 text-neutral-300 hover:bg-neutral-900 lg:hidden"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="truncate text-sm font-semibold text-white sm:text-base">{title}</h1>
            <span className="hidden text-xs text-neutral-600 sm:inline">/</span>
            <span className="hidden max-w-48 truncate rounded-md border border-neutral-800 px-2 py-1 text-xs text-neutral-400 sm:inline">{workspaceName}</span>
          </div>
          <IngestModal
            projectId={workspaceId}
            triggerLabel="New memory"
            onIngested={() => window.location.reload()}
          />
        </header>
        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
