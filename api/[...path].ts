import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import type { IncomingMessage, ServerResponse } from "node:http";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";

type CookieOptions = Record<string, unknown>;

type NodeResponseWithCookies = ServerResponse & {
  cookie: (name: string, value: string, options: CookieOptions) => void;
  clearCookie: (name: string, options: CookieOptions) => void;
};

function serializeCookie(name: string, value: string, options: CookieOptions) {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push(`SameSite=${String(options.sameSite).replace(/^./, character => character.toUpperCase())}`);
  if (typeof options.maxAge === "number") parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
  parts.push(`Path=${typeof options.path === "string" ? options.path : "/"}`);
  return parts.join("; ");
}

function withCookieMethods(response: ServerResponse): NodeResponseWithCookies {
  const target = response as NodeResponseWithCookies;
  target.cookie = (name, value, options) => {
    response.setHeader("Set-Cookie", serializeCookie(name, value, options));
  };
  target.clearCookie = (name, options) => {
    response.setHeader("Set-Cookie", serializeCookie(name, "", { ...options, maxAge: 0 }));
  };
  return target;
}

export default createHTTPHandler({
  router: appRouter,
  basePath: "/api/trpc/",
  createContext: ({ req, res, info }) => createContext({
    req: req as unknown as IncomingMessage,
    res: withCookieMethods(res as unknown as ServerResponse) as never,
    info,
  } as never),
});
