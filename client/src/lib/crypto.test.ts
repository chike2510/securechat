import { describe, expect, it } from "vitest";
import { isEncryptedPayload } from "./crypto";

describe("SecureChat ciphertext boundary", () => {
  it("recognises a base64 encrypted payload and rejects plaintext", () => {
    const encryptedFixture = btoa("a-cryptographic-payload-with-auth-tag");
    expect(isEncryptedPayload(encryptedFixture)).toBe(true);
    expect(isEncryptedPayload("Meet me after the lecture")).toBe(false);
  });
});
