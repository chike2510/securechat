import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedNodeHandler = vi.hoisted(() => vi.fn());
const mockedAuthenticate = vi.hoisted(() => vi.fn());

vi.mock("@trpc/server/adapters/node-http", () => ({
  nodeHTTPRequestHandler: mockedNodeHandler,
}));

vi.mock("../server/supabaseAuth.js", () => ({
  authenticateSupabaseRequest: mockedAuthenticate,
}));

import { handleTrpcRequest } from "../api/trpc/[...path]";

describe("Vercel tRPC handler", () => {
  beforeEach(() => {
    mockedNodeHandler.mockReset();
    mockedAuthenticate.mockReset();
    mockedAuthenticate.mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("returns a JSON 500 response when the native handler throws", async () => {
    mockedNodeHandler.mockRejectedValueOnce(new Error("controlled failure"));
    const response = {
      headersSent: false,
      writableEnded: false,
      statusCode: 200,
      setHeader: vi.fn(),
      end: vi.fn(),
    } as never;
    const request = {
      url: "/api/trpc/auth.me",
      headers: {},
      method: "GET",
    } as never;

    await handleTrpcRequest(request, response);

    expect(response.statusCode).toBe(500);
    expect(response.setHeader).toHaveBeenCalledWith("Content-Type", "application/json");
    expect(response.end).toHaveBeenCalledWith(JSON.stringify({ error: "SecureChat API invocation failed." }));
  });

  it("forwards authorization headers to the Supabase verifier", async () => {
    mockedNodeHandler.mockImplementationOnce(async (options: { createContext: (input: unknown) => Promise<unknown>; req: unknown; res: unknown }) => {
      await options.createContext({ req: options.req, res: options.res });
    });
    const request = {
      url: "/api/trpc/auth.me",
      headers: { authorization: ["Bearer test-token"] },
      method: "GET",
    } as never;
    const response = { headersSent: false, writableEnded: false, setHeader: vi.fn(), end: vi.fn() } as never;

    await handleTrpcRequest(request, response);

    expect(mockedAuthenticate).toHaveBeenCalledWith(expect.any(Headers));
    const passedHeaders = mockedAuthenticate.mock.calls[0]?.[0] as Headers;
    expect(passedHeaders.get("authorization")).toBe("Bearer test-token");
  });

  it("does not write a second response after headers have started", async () => {
    mockedNodeHandler.mockRejectedValueOnce(new Error("controlled failure"));
    const response = {
      headersSent: true,
      writableEnded: true,
      statusCode: 200,
      setHeader: vi.fn(),
      end: vi.fn(),
    } as never;
    const request = { url: "/api/trpc/auth.me", headers: {}, method: "GET" } as never;

    await handleTrpcRequest(request, response);

    expect(response.end).not.toHaveBeenCalled();
    expect(response.setHeader).not.toHaveBeenCalled();
  });
});
