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
    <div className="app-sidebar glass-panel flex h-full flex-col" style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
      <Link href="/app/overview" className="app-sidebar-brand flex h-16 items-center gap-3 px-5" onClick={onNavigate}>
        <span className="grid size-9 place-items-center rounded-xl border border-white/10 bg-white/5 font-semibold text-white">S</span>
        <span className="text-sm font-semibold tracking-[0.2em] text-white">SYNRA</span>
      </Link>
      <div className="app-workspace-switcher mx-4 mt-5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Workspace</p>
        <p className="mt-1 truncate text-sm font-medium text-white/90">{workspaceName}</p>
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
              className={`app-nav-link flex items-center gap-3 rounded-xl border-l-2 px-3 py-2.5 text-sm transition ${
                active
                  ? "border-white bg-white/10 font-medium text-white"
                  : "border-transparent text-white/50 hover:bg-white/5 hover:text-white"
              }`}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="app-sidebar-user border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/10 text-sm font-semibold text-white">
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
            className="rounded-xl p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
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
    <div className="dashboard-shell min-h-screen bg-[#0c0c0c] text-white" data-page={pathname}>
      <aside className="app-sidebar-frame fixed inset-y-0 left-0 z-30 hidden w-64 p-2 lg:block">
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
          <aside className="app-sidebar-frame absolute inset-y-0 left-0 w-72 max-w-[85vw] p-2 shadow-2xl">
            <Sidebar workspaceName={workspaceName} user={user} pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header
          className="app-topbar glass-panel sticky top-3 z-20 mx-3 flex h-16 items-center justify-between px-4 sm:mx-5 sm:px-6"
          style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setDrawerOpen(true)}
              className="rounded-xl p-2 text-white/70 hover:bg-white/10 lg:hidden"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className={`app-page-title truncate text-sm font-semibold text-white sm:text-base${pathname === "/app/graph" ? " shiny-text" : ""}`}>{title}</h1>
            <span className="hidden text-xs text-white/30 sm:inline">/</span>
            <span className="hidden max-w-48 truncate rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 sm:inline">{workspaceName}</span>
          </div>
          <IngestModal
            projectId={workspaceId}
            triggerLabel="New memory"
            onIngested={() => window.location.reload()}
          />
        </header>
        <main className="app-main min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
