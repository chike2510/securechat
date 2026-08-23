import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import type { Request, Response } from "express";
import { serialize } from "cookie";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";

type NodeResponseWithCookies = Response & {
  cookie: (name: string, value: string, options: Record<string, unknown>) => void;
  clearCookie: (name: string, options: Record<string, unknown>) => void;
};

function withCookieMethods(response: Response): NodeResponseWithCookies {
  const target = response as NodeResponseWithCookies;
  target.cookie = (name, value, options) => {
    response.setHeader("Set-Cookie", serialize(name, value, {
      httpOnly: Boolean(options.httpOnly),
      secure: Boolean(options.secure),
      sameSite: options.sameSite as "lax" | "strict" | "none" | undefined,
      maxAge: typeof options.maxAge === "number" ? Math.floor(options.maxAge / 1000) : undefined,
      path: typeof options.path === "string" ? options.path : "/",
    }));
  };
  target.clearCookie = (name, options) => {
    response.setHeader("Set-Cookie", serialize(name, "", {
      httpOnly: Boolean(options.httpOnly),
      secure: Boolean(options.secure),
      sameSite: options.sameSite as "lax" | "strict" | "none" | undefined,
      maxAge: 0,
      path: typeof options.path === "string" ? options.path : "/",
    }));
  };
  return target;
}

export default createHTTPHandler({
  router: appRouter,
  basePath: "/api/trpc/",
  createContext: ({ req, res }) => createContext({ req: req as unknown as Request, res: withCookieMethods(res as unknown as Response) }),
});
