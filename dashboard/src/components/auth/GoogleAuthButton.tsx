"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function GoogleAuthButton({ label }: { label: string }) {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState("");

  async function handleSignIn() {
    setIsSigningIn(true);
    setError("");

    const requestedCallback = new URLSearchParams(window.location.search).get("callbackUrl");
    const callbackUrl = requestedCallback?.startsWith("/") && !requestedCallback.startsWith("//")
      ? requestedCallback
      : requestedCallback?.startsWith(`${window.location.origin}/`)
        ? requestedCallback.slice(window.location.origin.length)
        : "/app";

    try {
      await signIn("google", { callbackUrl });
    } catch {
      setError("Unable to start Google sign-in. Please try again.");
      setIsSigningIn(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void handleSignIn()}
        disabled={isSigningIn}
        className="flex w-full items-center justify-center gap-3 rounded-md bg-white px-4 py-3.5 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:cursor-wait disabled:opacity-70"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="currentColor">
          <path d="M21.35 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.95 2.94v2.4h3.16c1.85-1.7 2.9-4.2 2.9-7.17Z" />
          <path d="M12 21.75c2.65 0 4.87-.88 6.49-2.36l-3.16-2.4c-.88.59-2 .94-3.33.94-2.56 0-4.73-1.73-5.51-4.06H3.22v2.48A9.8 9.8 0 0 0 12 21.75Z" />
          <path d="M6.49 13.87a5.9 5.9 0 0 1 0-3.75V7.64H3.22a9.8 9.8 0 0 0 0 8.71l3.27-2.48Z" />
          <path d="M12 6.06c1.45 0 2.75.5 3.77 1.49l2.83-2.83C16.86 3.14 14.65 2.12 12 2.12a9.8 9.8 0 0 0-8.78 5.52l3.27 2.48C7.27 7.79 9.44 6.06 12 6.06Z" />
        </svg>
        {isSigningIn ? "Connecting to Google…" : label}
      </button>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-rose-300">
          {error}
        </p>
      ) : null}
    </>
  );
}
