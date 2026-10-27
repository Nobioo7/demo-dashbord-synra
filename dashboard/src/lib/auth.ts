import { getToken } from "next-auth/jwt";
import { headers } from "next/headers";
import { NextRequest } from "next/server";

export async function getDashboardToken() {
  const request = new NextRequest("https://synra.invalid", {
    headers: await headers(),
  });
  return getToken({ req: request });
}
