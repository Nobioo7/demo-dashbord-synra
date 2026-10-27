"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSigningIn(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        callbackUrl: "/app/overview",
        redirect: false,
      });

      if (!result || result.error) {
        setError("Unable to sign in. Check your details and try again.");
        setIsSigningIn(false);
        return;
      }

      window.location.assign(result.url || "/app/overview");
    } catch {
      setError("Unable to sign in right now. Please try again.");
      setIsSigningIn(false);
    }
  }

  return (
    <>
      <p className="mb-2 text-sm font-medium text-neutral-400">Welcome back</p>
      <h1 className="text-3xl font-semibold tracking-tight text-white">Sign in to Synra</h1>
      <p className="mt-3 text-sm leading-6 text-neutral-400">
        Pick up where your team’s engineering memory left off.
      </p>
      <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-neutral-300">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/30"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-neutral-300">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/30"
          />
        </div>
        {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}
        <button
          type="submit"
          disabled={isSigningIn}
          className="flex w-full items-center justify-center rounded-full bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-wait disabled:opacity-70"
        >
          {isSigningIn ? "Signing in…" : "Sign In"}
        </button>
        {process.env.NODE_ENV === "development" ? (
          <p className="text-center text-xs text-neutral-500">
            Local development login accepts any non-empty email and password.
          </p>
        ) : null}
      </form>
      <p className="mt-6 text-center text-sm text-neutral-400">
        New to Synra?{" "}
        <Link href="/signup" className="font-medium text-white underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
