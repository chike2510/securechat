import { describe, expect, it } from "vitest";
import { listEncryptedMessages, updateMessageStatus } from "./db";

describe("SecureChat participant access", () => {
  it("rejects reading a conversation when membership cannot be verified", async () => {
    await expect(listEncryptedMessages(1001, 9001)).rejects.toThrow("Unauthorized conversation access");
  });

  it("rejects status updates for an unverified message participant", async () => {
    await expect(updateMessageStatus(1001, 7001, "delivered")).rejects.toThrow("Unauthorized message access");
  });
});
