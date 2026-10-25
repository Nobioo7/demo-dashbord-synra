import { useSyncExternalStore } from "react";

export type MemoryItem = {
  id: string;
  content: string;
  prompt: string;
  response: string;
  source: string;
  event_type: string;
  created_at: string;
  workspace_id: string;
  project_id: string;
  metadata: Record<string, unknown>;
};

export type MemoryListResponse = {
  items: MemoryItem[];
  total: number;
};

function subscribeToWorkspaceCookie() {
  return () => undefined;
}

function getServerWorkspaceId(): null {
  return null;
}

export function getWorkspaceIdFromCookie(): string | null {
  if (typeof document === "undefined") return null;

  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("synra_workspace="));
  if (!cookie) return null;

  try {
    const workspaceId = decodeURIComponent(cookie.slice("synra_workspace=".length)).trim();
    return workspaceId || null;
  } catch {
    return null;
  }
}

export function useWorkspaceIdFromCookie(): string | null {
  return useSyncExternalStore(
    subscribeToWorkspaceCookie,
    getWorkspaceIdFromCookie,
    getServerWorkspaceId,
  );
}

export function buildMemoriesUrl(
  workspaceId: string,
  params: Record<string, string | number | undefined>,
): string {
  const searchParams = new URLSearchParams({ workspace_id: workspaceId });
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && String(value).length > 0) {
      searchParams.set(key, String(value));
    }
  }
  return `/backend/api/v1/memories?${searchParams.toString()}`;
}

export async function getErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown; message?: unknown };
    if (typeof body.detail === "string") return body.detail;
    if (typeof body.message === "string") return body.message;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
  return `Request failed with status ${response.status}.`;
}
