import Link from "next/link";
import GoogleAuthButton from "@/components/auth/GoogleAuthButton";

export default function LoginPage() {
  return (
    <>
      <p className="mb-2 text-sm font-medium text-neutral-400">Welcome back</p>
      <h1 className="text-3xl font-semibold tracking-tight text-white">Sign in to Synra</h1>
      <p className="mt-3 text-sm leading-6 text-neutral-400">
        Pick up where your team’s engineering memory left off.
      </p>
      <div className="mt-8">
        <GoogleAuthButton label="Continue with Google" />
      </div>
      <p className="mt-6 text-center text-sm text-neutral-400">
        New to Synra?{" "}
        <Link href="/signup" className="font-medium text-white underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
