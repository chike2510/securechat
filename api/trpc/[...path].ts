import { nodeHTTPRequestHandler } from "@trpc/server/adapters/node-http";
import { appRouter } from "../../server/routers.js";
import { authenticateSupabaseRequest } from "../../server/supabaseAuth.js";

export default function handler(req: Parameters<typeof nodeHTTPRequestHandler>[0]["req"], res: Parameters<typeof nodeHTTPRequestHandler>[0]["res"]) {
  const path = (req.url ?? "").split("?")[0].replace(/^\/api\/trpc\/?/, "");

  return nodeHTTPRequestHandler({
    req,
    res,
    path,
    router: appRouter,
    createContext: async ({ req: request, res: response }) => ({
      req: request as never,
      res: response as never,
      user: (await authenticateSupabaseRequest(request.headers)) ?? null,
    }),
  });
}
