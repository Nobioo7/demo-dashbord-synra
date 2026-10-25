import { getToken } from "next-auth/jwt";
import { headers } from "next/headers";
import { NextRequest } from "next/server";

export async function getDashboardToken() {
  const request = new NextRequest("http://localhost", {
    headers: await headers(),
  });
  return getToken({ req: request });
}
