import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { IncomingMessage, ServerResponse } from "node:http";
import { appRouter } from "../server/routers";
import { authenticateSupabaseRequest } from "../server/supabaseAuth";

function serializeCookie(name: string, value: string, options: Record<string, unknown>) {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push(`SameSite=${String(options.sameSite).replace(/^./, character => character.toUpperCase())}`);
  if (typeof options.maxAge === "number") parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
  parts.push(`Path=${typeof options.path === "string" ? options.path : "/"}`);
  return parts.join("; ");
}

function readBody(req: IncomingMessage & { body?: unknown }) {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  if (typeof req.body === "string") return req.body;
  return req.body === undefined ? undefined : JSON.stringify(req.body);
}

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  const host = req.headers.host ?? "localhost";
  const protocol = (req.headers["x-forwarded-proto"] as string | undefined) ?? "https";
  const url = `${protocol}://${host}${req.url ?? "/api/trpc"}`;
  const request = new Request(url, {
    method: req.method,
    headers: Object.entries(req.headers).flatMap(([key, value]) => value === undefined ? [] : [[key, Array.isArray(value) ? value.join(", ") : value]]),
    body: readBody(req),
  });
  const cookies: string[] = [];
  const context = async ({ req: fetchRequest }: { req: Request }) => ({
    req: { headers: { cookie: fetchRequest.headers.get("cookie") ?? "" } },
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push(serializeCookie(name, value, options)),
      clearCookie: (name: string, options: Record<string, unknown>) => cookies.push(serializeCookie(name, "", { ...options, maxAge: 0 })),
    },
    user: await authenticateSupabaseRequest(fetchRequest.headers),
  });
  const response = await fetchRequestHandler({ endpoint: "/api/trpc", req: request, router: appRouter, createContext: context as never });
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  if (cookies.length > 0) res.setHeader("Set-Cookie", cookies);
  res.end(await response.text());
}
