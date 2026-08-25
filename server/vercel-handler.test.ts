import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedNodeHandler = vi.hoisted(() => vi.fn());

vi.mock("@trpc/server/adapters/node-http", () => ({
  nodeHTTPRequestHandler: mockedNodeHandler,
}));

import { handleTrpcRequest } from "../api/trpc/[...path]";

describe("Vercel tRPC handler", () => {
  beforeEach(() => {
    mockedNodeHandler.mockReset();
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
