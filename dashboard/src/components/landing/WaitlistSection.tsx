"use client";

import { FormEvent, useRef, useState } from "react";

type WaitlistSectionProps = {
  showToast: (message: string) => void;
};

export default function WaitlistSection({ showToast }: WaitlistSectionProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const email = form.querySelector<HTMLInputElement>('input[type="email"]')?.value;
    if (!email) {
      showToast("Something went wrong. Try again later.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/backend/api/v1/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "landing" }),
      });
      if (response.status === 429) {
        showToast("Too many attempts. Try again in a minute.");
        return;
      }
      if (response.status !== 200) {
        showToast("Something went wrong. Try again later.");
        return;
      }

      const result = (await response.json()) as { status?: string };
      if (result.status === "registered") {
        form.reset();
        showToast("Welcome aboard. We'll be in touch.");
      } else if (result.status === "already_registered") {
        showToast("You're already on the list.");
      } else {
        showToast("Something went wrong. Try again later.");
      }
    } catch {
      showToast("Something went wrong. Try again later.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="waitlist" className="content-layer border-t border-white/5 px-6 py-40 md:py-56">
      <div className="mx-auto max-w-[900px] text-center">
        <p className="fade-up mb-12 text-[12px] tracking-[.3em] text-[#86868b] uppercase">Early access</p>
        <h2 className="fade-up d1 font-sans text-[clamp(2rem,6vw,5rem)] leading-[1.05] font-semibold tracking-tightest text-[#f5f5f7]">
          Be first.
        </h2>
        <p className="fade-up d2 mx-auto mt-10 max-w-xl text-[17px] leading-[1.55] tracking-tight text-[#86868b] md:text-[19px]">
          We&apos;re onboarding a small group of design partners. Tell us about your team and we&apos;ll reach out.
        </p>
        <form ref={formRef} onSubmit={submit} className="fade-up d3 mx-auto mt-16 max-w-lg">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              required
              placeholder="you@company.com"
              aria-label="Email address"
              className="min-w-0 flex-1 rounded-md border border-neutral-800 bg-black px-6 py-4 text-[15px] text-white outline-none transition-colors duration-300 placeholder:text-neutral-500 focus:border-neutral-500"
            />
            <button type="submit" disabled={submitting} className="btn btn-white justify-center rounded-md px-8 py-4 text-[14px] font-medium whitespace-nowrap">
              Request Access
            </button>
          </div>
          <p className="mt-5 text-[12px] tracking-tight text-[#86868b]">
            We respond within 24 hours. No credit card required.
          </p>
        </form>
      </div>
    </section>
  );
}
