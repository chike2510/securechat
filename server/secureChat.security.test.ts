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
  it("rejects accounts without a registered matric identity", async () => {
    const caller = appRouter.createCaller(contextFor("visitor@example.com"));
    await expect(caller.secureChat.searchUsers({ query: "alex" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("accepts a normal email when the account has a matric identity", async () => {
    const caller = appRouter.createCaller({ ...contextFor("student.personal@gmail.com"), user: { ...contextFor("student.personal@gmail.com").user!, matricNumber: "FUPRE-001", universityEmail: "student.personal@gmail.com" } });
    await expect(caller.secureChat.searchUsers({ query: "alex" })).resolves.toEqual([]);
  });

  it("recognises ciphertext-shaped payloads but not readable plaintext", () => {
    expect(isEncryptedPayload(btoa("encrypted-payload-with-authenticated-tag"))).toBe(true);
    expect(isEncryptedPayload("Meet me at the library")).toBe(false);
  });
});
