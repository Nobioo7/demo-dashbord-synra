import { redirect } from "next/navigation";
import { getDashboardToken } from "@/lib/auth";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await getDashboardToken())) {
    redirect("/login?callbackUrl=%2Fonboarding");
  }

  return children;
}
