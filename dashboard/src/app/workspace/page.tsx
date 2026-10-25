"use client";
import { useSession, signIn } from "next-auth/react";
import BrainGraph from "@/components/BrainGraph";

export default function Workspace() {
  const { data: session, status } = useSession();
  if (status === "loading") return <div className="text-white p-10">Loading...</div>;
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
        <h1 className="text-3xl mb-4">Welcome to Synra</h1>
        <button onClick={() => signIn("google")} className="bg-white text-black px-6 py-2 rounded font-bold">
          Sign in with Google
        </button>
      </div>
    );
  }
  return <div className="w-screen h-screen bg-black"><BrainGraph /></div>;
}
