import NextAuth from "next-auth";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

const providers: NextAuthOptions["providers"] = [];

if (process.env.NODE_ENV === "development") {
  providers.push(
    CredentialsProvider({
      name: "Local development",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim();
        const password = credentials?.password;
        if (!email || !password?.trim()) return null;

        return { id: "1", name: "Local User", email };
      },
    }),
  );
} else if (
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  !process.env.GOOGLE_CLIENT_ID.startsWith("placeholder_") &&
  !process.env.GOOGLE_CLIENT_SECRET.startsWith("placeholder_")
) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

const authOptions: NextAuthOptions = {
  providers,
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
