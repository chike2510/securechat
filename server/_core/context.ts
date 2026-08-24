import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema.js";
import { authenticateSupabaseRequest } from "../supabaseAuth.js";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;
  try { user = (await authenticateSupabaseRequest(opts.req.headers)) ?? null; } catch { user = null; }
  return { req: opts.req, res: opts.res, user };
}
