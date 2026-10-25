import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getDashboardToken } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  if (await getDashboardToken()) {
    redirect("/app/overview");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-5 py-12 text-neutral-100">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-lg border border-neutral-800 bg-neutral-950 text-xl font-semibold text-white">
            S
          </div>
          <p className="text-sm font-semibold tracking-[0.28em] text-white">SYNRA</p>
        </div>
        <section className="rounded-lg border border-neutral-800 bg-neutral-950 p-7 shadow-2xl shadow-black sm:p-9">
          {children}
        </section>
        <p className="mt-6 text-center text-xs text-neutral-500">
          Your persistent memory layer for engineering teams.
        </p>
      </div>
    </main>
  );
}
