import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("http://127.0.0.1:3000"),
  title: "Synra — The AI Engineering Brain",
  description: "A shared, evidence-backed memory layer for engineering teams and AI coding tools.",
};

import AuthProvider from "@/components/AuthProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body style={{ background: "#000", color: "#fff" }}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
