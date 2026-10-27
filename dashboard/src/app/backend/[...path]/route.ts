import type { NextRequest } from "next/server";
import { createHmac } from "node:crypto";
import { getToken } from "next-auth/jwt";

const BACKEND_URL = (
  process.env.SYNRA_BACKEND_URL?.trim()
  || (process.env.NODE_ENV === "production" ? "" : "http://127.0.0.1:8000")
).replace(/\/+$/, "");

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxy(request: NextRequest, { params }: RouteContext): Promise<Response> {
  if (!BACKEND_URL) {
    return Response.json({ detail: "Backend proxy is not configured." }, { status: 500 });
  }

  const { path } = await params;
  const publicWaitlist = path.join("/") === "api/v1/waitlist";
  const token = publicWaitlist ? null : await getToken({ req: request });
  if (!publicWaitlist && !token) {
    return Response.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const userId = typeof token?.sub === "string" ? token.sub.trim() : "";
  const sessionSecret = process.env.SYNRA_SESSION_SECRET?.trim();
  if (!publicWaitlist && (!userId || !sessionSecret)) {
    return Response.json({ detail: "Backend proxy is not configured." }, { status: 500 });
  }

  const authTimestamp = Math.floor(Date.now() / 1000).toString();
  const authSignature = userId && sessionSecret
    ? createHmac("sha256", sessionSecret)
      .update(`${userId}\n${authTimestamp}`)
      .digest("hex")
    : "";
  const requestUrl = new URL(request.url);
  const upstreamUrl = `${BACKEND_URL}/${path.map(encodeURIComponent).join("/")}${requestUrl.search}`;
  const headers = new Headers(request.headers);
  headers.delete("x-api-key");
  headers.delete("x-synra-user-id");
  headers.delete("x-synra-auth-timestamp");
  headers.delete("x-synra-auth-signature");
  headers.delete("cookie");
  if (userId && authSignature) {
    headers.set("X-Synra-User-Id", userId);
    headers.set("X-Synra-Auth-Timestamp", authTimestamp);
    headers.set("X-Synra-Auth-Signature", authSignature);
  }
  headers.delete("authorization");
  headers.delete("connection");
  headers.delete("host");
  headers.delete("content-length");

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer(),
    cache: "no-store",
    redirect: "manual",
  });
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("connection");
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
  responseHeaders.delete("transfer-encoding");

  return new Response(
    request.method === "HEAD" ? null : upstream.body,
    {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    },
  );
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
