import Link from "next/link";
import GoogleAuthButton from "@/components/auth/GoogleAuthButton";

export default function SignupPage() {
  return (
    <>
      <p className="mb-2 text-sm font-medium text-neutral-400">Get started</p>
      <h1 className="text-3xl font-semibold tracking-tight text-white">Create your account</h1>
      <p className="mt-3 text-sm leading-6 text-neutral-400">
        Use your Google account to start a Synra workspace. Account creation is handled by the
        configured sign-in provider.
      </p>
      <div className="mt-8">
        <GoogleAuthButton label="Sign up with Google" />
      </div>
      <p className="mt-6 text-center text-sm text-neutral-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-white underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
