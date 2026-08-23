import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { isEncryptedPayload } from "../client/src/lib/crypto";
import type { TrpcContext } from "./_core/context";

function contextFor(email: string): TrpcContext {
  return {
    user: {
      id: 44,
      openId: "security-test-user",
      email,
      name: "Security Test User",
      loginMethod: "test",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("SecureChat security boundaries", () => {
  it("rejects non-university accounts before conversation access", async () => {
    const caller = appRouter.createCaller(contextFor("visitor@example.com"));
    await expect(caller.secureChat.searchUsers({ query: "alex" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("recognises ciphertext-shaped payloads but not readable plaintext", () => {
    expect(isEncryptedPayload(btoa("encrypted-payload-with-authenticated-tag"))).toBe(true);
    expect(isEncryptedPayload("Meet me at the library")).toBe(false);
  });
});
