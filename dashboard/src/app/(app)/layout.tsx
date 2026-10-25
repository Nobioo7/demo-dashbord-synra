import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AppShell from "@/components/app/AppShell";
import { getDashboardToken } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const token = await getDashboardToken();
  if (!token) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("synra_workspace")?.value;
  const workspaceName = cookieStore.get("synra_workspace_name")?.value;
  if (!workspaceId || !workspaceName) {
    redirect("/onboarding");
  }

  return (
    <AppShell
      workspaceId={workspaceId}
      workspaceName={workspaceName}
      user={{
        name: typeof token.name === "string" ? token.name : null,
        email: typeof token.email === "string" ? token.email : null,
      }}
    >
      {children}
    </AppShell>
  );
}
