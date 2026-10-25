import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("synra_workspace")?.value;
  const workspaceName = cookieStore.get("synra_workspace_name")?.value;
  if (!workspaceId || !workspaceName) {
    redirect("/onboarding");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-white">Workspace settings</h2>
        <p className="mt-2 text-sm text-neutral-400">Your current workspace details and plan.</p>
      </div>
      <section className="divide-y divide-neutral-800 rounded-md border border-neutral-800 bg-black">
        <div className="flex items-start justify-between gap-6 px-5 py-5">
          <div>
            <h3 className="text-sm font-medium text-neutral-200">Workspace name</h3>
            <p className="mt-1 text-xs text-neutral-500">The name used across your Synra workspace.</p>
          </div>
          <p className="max-w-[50%] break-words text-right text-sm text-white">
            {workspaceName}
          </p>
        </div>
        <div className="flex items-start justify-between gap-6 px-5 py-5">
          <div>
            <h3 className="text-sm font-medium text-neutral-200">Workspace ID</h3>
            <p className="mt-1 text-xs text-neutral-500">The identifier used to scope API requests.</p>
          </div>
          <p className="max-w-[50%] break-all text-right font-mono text-xs text-neutral-300">
            {workspaceId}
          </p>
        </div>
        <div className="flex items-start justify-between gap-6 px-5 py-5">
          <div>
            <h3 className="text-sm font-medium text-neutral-200">Plan</h3>
            <p className="mt-1 text-xs text-neutral-500">Your current workspace subscription.</p>
          </div>
          <p className="text-sm text-white">Free</p>
        </div>
      </section>
      <p className="text-xs text-neutral-500">Workspace settings are read-only in this phase.</p>
    </div>
  );
}
