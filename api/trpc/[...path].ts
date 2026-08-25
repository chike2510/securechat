import { nodeHTTPRequestHandler } from "@trpc/server/adapters/node-http";
import { appRouter } from "../../server/routers.js";
import { authenticateSupabaseRequest } from "../../server/supabaseAuth.js";

export async function handleTrpcRequest(req: Parameters<typeof nodeHTTPRequestHandler>[0]["req"], res: Parameters<typeof nodeHTTPRequestHandler>[0]["res"]) {
  const path = (req.url ?? "").split("?")[0].replace(/^\/api\/trpc\/?/, "");

  try {
    await nodeHTTPRequestHandler({
      req,
      res,
      path,
      router: appRouter,
      createContext: async ({ req: request, res: response }) => {
        let user = null;
        try {
          const authorization = request.headers.authorization;
          const normalizedHeaders = new Headers();
          if (typeof authorization === "string") normalizedHeaders.set("authorization", authorization);
          user = (await authenticateSupabaseRequest(normalizedHeaders)) ?? null;
        } catch (error) {
          console.error("[Vercel tRPC] Supabase auth lookup failed", error);
        }
        return { req: request as never, res: response as never, user };
      },
    });
  } catch (error) {
    console.error("[Vercel tRPC] invocation failed", error);
    const response = res as typeof res & { writableEnded?: boolean };
    if (!res.headersSent && !response.writableEnded) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "SecureChat API invocation failed." }));
    }
  }
}

export default handleTrpcRequest;
