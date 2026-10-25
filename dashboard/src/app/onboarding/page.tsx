"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/memories";

export default function OnboardingPage() {
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = workspaceName.trim();
    if (!name) {
      setError("Enter a workspace name to continue.");
      return;
    }

    setCreating(true);
    setError("");
    try {
      const response = await fetch("/backend/api/v1/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error(await getErrorMessage(response));
      const workspace = (await response.json()) as { id?: unknown; name?: unknown };
      if (typeof workspace.id !== "string" || typeof workspace.name !== "string") {
        throw new Error("The backend returned an invalid workspace.");
      }

      const secureCookie = window.location.protocol === "https:" ? "; Secure" : "";
      const cookieOptions = `; Path=/; Max-Age=31536000; SameSite=Lax${secureCookie}`;
      document.cookie = `synra_workspace=${encodeURIComponent(workspace.id)}${cookieOptions}`;
      document.cookie = `synra_workspace_name=${encodeURIComponent(workspace.name)}${cookieOptions}`;
      router.push("/app/overview");
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to create workspace.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-5 py-12 text-neutral-100">
      <section className="w-full max-w-lg rounded-lg border border-neutral-800 bg-neutral-950 p-8 shadow-2xl shadow-black sm:p-10">
        <div className="mb-8 grid size-12 place-items-center rounded-lg border border-neutral-800 bg-black text-xl font-semibold text-white">
          S
        </div>
        <p className="text-sm font-medium text-neutral-400">One quick step</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
          Name your workspace
        </h1>
        <p className="mt-3 text-sm leading-6 text-neutral-400">
          Give your team’s shared engineering memory a name. You can change it later.
        </p>
        <form onSubmit={createWorkspace} className="mt-8 space-y-4">
          <label htmlFor="workspace-name" className="block text-sm font-medium text-neutral-300">
            Workspace name
          </label>
          <input
            id="workspace-name"
            autoFocus
            maxLength={64}
            value={workspaceName}
            onChange={(event) => {
              setWorkspaceName(event.target.value);
              setError("");
            }}
            placeholder="e.g. Acme Engineering"
            className="w-full rounded-md border border-neutral-800 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-neutral-500"
          />
          {error ? (
            <p role="alert" className="text-sm text-rose-300">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={creating}
            className="w-full rounded-md bg-white px-4 py-3.5 text-sm font-medium text-black transition hover:bg-neutral-200"
          >
            {creating ? "Creating workspace…" : "Create workspace"}
          </button>
        </form>
      </section>
    </main>
  );
}
