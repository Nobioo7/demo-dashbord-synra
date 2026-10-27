import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getDashboardToken } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  if (await getDashboardToken()) {
    redirect("/app/overview");
  }

  return (
    <main className="auth-shell flex min-h-screen items-center justify-center px-5 py-12 text-neutral-100">
      <video className="auth-background" autoPlay muted loop playsInline preload="metadata" aria-hidden="true">
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_064122_c4750c0e-7476-4b44-94a2-a85a65c63bf2.mp4"
          type="video/mp4"
        />
      </video>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-lg border border-neutral-800 bg-neutral-950 text-xl font-semibold text-white">
            S
          </div>
          <p className="text-sm font-semibold tracking-[0.28em] text-white">SYNRA</p>
        </div>
        <section
          className="auth-card auth-window glass-panel"
          style={{ backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}
        >
          <div className="auth-window-bar" aria-hidden="true">
            <span className="auth-window-dot" />
            <span className="auth-window-dot" />
            <span className="auth-window-dot" />
          </div>
          <div className="auth-window-content">{children}</div>
        </section>
        <p className="mt-6 text-center text-xs text-neutral-500">
          Your persistent memory layer for engineering teams.
        </p>
      </div>
    </main>
  );
}
